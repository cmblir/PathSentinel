// PathSentinel scanner: privacy-first traversal + content rules.
//
// Design choices:
//   - Content of paths matched by PRIVACY_DENY_LIST is never read.
//     The deny-list is enforced at the directory walk layer (glob ignore).
//   - SENSITIVE_FILES are reported by basename only; their bytes are not
//     attached to findings.
//   - Secret detection is best-effort and line-based. Excerpts attached to
//     findings are redacted to avoid leaking the full secret to the model.

import { promises as fs } from "node:fs";
import * as path from "node:path";
import { glob } from "glob";

import {
  BINARY_EXTENSIONS,
  PRIVACY_DENY_LIST,
  SECRET_PATTERNS,
  SENSITIVE_FILES,
  type SecretRule,
} from "./patterns.js";
import type { Finding, ScanResult, ScanSummary } from "./types.js";

const MAX_FILE_BYTES = 1024 * 1024; // 1 MiB
const MAX_EXCERPT_LEN = 120;

export interface ScannerOptions {
  /** Hard cap on per-file byte read. Defaults to 1 MiB. */
  maxFileBytes?: number;
  /** Extra glob patterns to ignore on top of PRIVACY_DENY_LIST. */
  extraIgnore?: string[];
  /** Follow symlinks during traversal. Off by default to avoid loops. */
  followSymlinks?: boolean;
}

export class ProjectGuardian {
  private readonly maxFileBytes: number;
  private readonly ignore: string[];
  private readonly followSymlinks: boolean;

  constructor(opts: ScannerOptions = {}) {
    this.maxFileBytes = opts.maxFileBytes ?? MAX_FILE_BYTES;
    this.ignore = [...PRIVACY_DENY_LIST, ...(opts.extraIgnore ?? [])];
    this.followSymlinks = opts.followSymlinks ?? false;
  }

  async scan(targetPath: string): Promise<ScanResult> {
    const start = Date.now();
    const absolutePath = path.resolve(targetPath);

    let stats: import("node:fs").Stats;
    try {
      stats = await fs.stat(absolutePath);
    } catch {
      throw new Error(`Path does not exist: ${targetPath}`);
    }

    const findings: Finding[] = [];
    const summary: ScanSummary = {
      scannedFiles: 0,
      skippedBinary: 0,
      skippedLarge: 0,
      blockedByPrivacy: 0,
      durationMs: 0,
    };

    if (!stats.isDirectory()) {
      this.checkSensitiveFile(absolutePath, findings);
      await this.inspectFile(absolutePath, findings, summary);
      summary.durationMs = Date.now() - start;
      return { target: absolutePath, findings, summary };
    }

    // Count entries that would be blocked by privacy rules so the operator
    // sees that paths exist but were intentionally skipped.
    const allEntries = await glob("**/*", {
      cwd: absolutePath,
      nodir: true,
      absolute: true,
      dot: true,
      follow: this.followSymlinks,
    });
    const visibleEntries = await glob("**/*", {
      cwd: absolutePath,
      ignore: this.ignore,
      nodir: true,
      absolute: true,
      dot: true,
      follow: this.followSymlinks,
    });
    summary.blockedByPrivacy = Math.max(
      0,
      allEntries.length - visibleEntries.length,
    );

    for (const file of visibleEntries) {
      this.checkSensitiveFile(file, findings);
      await this.inspectFile(file, findings, summary);
    }

    summary.durationMs = Date.now() - start;
    return { target: absolutePath, findings, summary };
  }

  private async inspectFile(
    filePath: string,
    findings: Finding[],
    summary: ScanSummary,
  ): Promise<void> {
    let stats: import("node:fs").Stats;
    try {
      stats = await fs.stat(filePath);
    } catch (err) {
      // File disappeared between glob and stat, or permission denied.
      // Surface, do not silently swallow.
      console.error(
        `[path-sentinel] cannot stat ${filePath}: ${(err as Error).message}`,
      );
      return;
    }

    if (stats.size > this.maxFileBytes) {
      summary.skippedLarge += 1;
      return;
    }

    if (this.isLikelyBinary(filePath)) {
      summary.skippedBinary += 1;
      return;
    }

    let content: string;
    try {
      content = await fs.readFile(filePath, "utf-8");
    } catch (err) {
      console.error(
        `[path-sentinel] cannot read ${filePath}: ${(err as Error).message}`,
      );
      return;
    }

    // Heuristic: NUL byte strongly suggests binary; bail out.
    if (content.includes("\u0000")) {
      summary.skippedBinary += 1;
      return;
    }

    summary.scannedFiles += 1;
    this.matchSecretRules(filePath, content, findings);
  }

  private matchSecretRules(
    filePath: string,
    content: string,
    findings: Finding[],
  ): void {
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (!line) continue;
      for (const rule of SECRET_PATTERNS) {
        if (rule.pattern.test(line)) {
          findings.push(this.buildSecretFinding(rule, filePath, line, i + 1));
        }
      }
    }
  }

  private buildSecretFinding(
    rule: SecretRule,
    filePath: string,
    line: string,
    lineNumber: number,
  ): Finding {
    return {
      severity: rule.confidence === "low" ? "medium" : "high",
      type: "Hardcoded Secret",
      rule: rule.label,
      file: filePath,
      description: `Possible ${rule.label} detected (confidence: ${rule.confidence}).`,
      line: lineNumber,
      excerpt: redact(line, rule.pattern),
    };
  }

  private checkSensitiveFile(filePath: string, findings: Finding[]): void {
    const fileName = path.basename(filePath);
    if (!SENSITIVE_FILES.includes(fileName)) return;
    findings.push({
      severity: "medium",
      type: "Sensitive File",
      rule: "Sensitive Config",
      file: filePath,
      description: `Sensitive configuration file present: ${fileName}. File contents are NOT included in this report.`,
    });
  }

  private isLikelyBinary(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase();
    return BINARY_EXTENSIONS.includes(ext);
  }
}

/** Redact the matched portion and trim the surrounding context. */
function redact(line: string, pattern: RegExp): string {
  const match = line.match(pattern);
  let safe = line;
  if (match && match[0]) {
    const visible = match[0].slice(0, 4);
    safe = line.replace(match[0], `${visible}…[REDACTED]`);
  }
  if (safe.length > MAX_EXCERPT_LEN) {
    safe = `${safe.slice(0, MAX_EXCERPT_LEN)}…`;
  }
  return safe.trim();
}
