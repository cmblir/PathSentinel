// Human-readable formatter for terminal use.
//
// Severity gets coloured when colour is enabled (default: TTY only).
// Output is intentionally minimal — one line per finding plus a summary.

import * as path from "node:path";

import type { Finding, ScanResult, Severity } from "../types.js";

export interface TextFormatOptions {
  color: boolean;
  quiet: boolean;
  severityFilter?: Severity;
  cwd?: string;
}

const SEVERITY_RANK: Record<Severity, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

const COLOR_BY_SEVERITY: Record<Severity, string> = {
  high: "\x1b[31m", // red
  medium: "\x1b[33m", // yellow
  low: "\x1b[36m", // cyan
};

const RESET = "\x1b[0m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";

export function formatText(
  result: ScanResult,
  opts: TextFormatOptions,
): string {
  const cwd = opts.cwd ?? process.cwd();
  const minRank = opts.severityFilter ? SEVERITY_RANK[opts.severityFilter] : 0;

  const visible = result.findings.filter(
    (f) => SEVERITY_RANK[f.severity] >= minRank,
  );

  const lines: string[] = [];
  if (visible.length === 0) {
    lines.push(paint("No findings.", opts.color ? "\x1b[32m" : "", opts.color));
  } else {
    lines.push(
      paint(
        `${visible.length} finding${visible.length === 1 ? "" : "s"}`,
        BOLD,
        opts.color,
      ),
    );
    for (const f of visible) {
      lines.push(formatLine(f, cwd, opts.color));
    }
  }

  if (!opts.quiet) {
    lines.push("");
    lines.push(formatSummary(result, cwd, opts.color));
  }

  return lines.join("\n");
}

function formatLine(f: Finding, cwd: string, color: boolean): string {
  const tag = `[${f.severity}]`.padEnd(8);
  const colouredTag = paint(tag, COLOR_BY_SEVERITY[f.severity], color);
  const rel = relativise(f.file, cwd);
  const where = f.line !== undefined ? `${rel}:${f.line}` : rel;
  const tail = f.excerpt
    ? `\n${paint("        " + f.excerpt, DIM, color)}`
    : "";
  return `  ${colouredTag} ${f.rule.padEnd(28)} ${where}${tail}`;
}

function formatSummary(result: ScanResult, cwd: string, color: boolean): string {
  const s = result.summary;
  const target = relativise(result.target, cwd);
  const parts = [
    `target=${target}`,
    `scanned=${s.scannedFiles}`,
    `binary=${s.skippedBinary}`,
    `large=${s.skippedLarge}`,
    `privacy_blocked=${s.blockedByPrivacy}`,
    `${s.durationMs}ms`,
  ];
  return paint(parts.join("  "), DIM, color);
}

function relativise(absPath: string, cwd: string): string {
  if (!absPath.startsWith(cwd)) return absPath;
  const rel = path.relative(cwd, absPath);
  return rel.length === 0 ? "." : rel;
}

function paint(text: string, code: string, color: boolean): string {
  if (!color || !code) return text;
  return `${code}${text}${RESET}`;
}
