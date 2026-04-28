// Baseline / diff support.
//
// A baseline file is just a previous PathSentinel JSON report. When a
// baseline is supplied, findings whose fingerprint matches an entry in
// the baseline are filtered out of the live result. This lets teams
// adopt PathSentinel on a legacy repo without having to fix everything
// before the gate goes green.
//
// Fingerprint = (rule | file | line | type). Excerpt is intentionally
// excluded: it can change because of redaction width or whitespace
// without representing a different finding.

import { promises as fs } from "node:fs";

import type { Finding, ScanResult } from "./types.js";

export async function loadBaseline(filePath: string): Promise<Set<string>> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf-8");
  } catch (err) {
    throw new Error(
      `Cannot read baseline file ${filePath}: ${(err as Error).message}`,
    );
  }

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `Baseline file is not valid JSON (${filePath}): ${(err as Error).message}`,
    );
  }

  const findings = (data as Partial<ScanResult>)?.findings;
  if (!Array.isArray(findings)) {
    throw new Error(
      `Baseline file does not contain a 'findings' array: ${filePath}`,
    );
  }

  const fingerprints = new Set<string>();
  for (const f of findings as Finding[]) {
    fingerprints.add(fingerprint(f));
  }
  return fingerprints;
}

export function applyBaseline(
  result: ScanResult,
  baseline: Set<string>,
): ScanResult {
  return {
    ...result,
    findings: result.findings.filter((f) => !baseline.has(fingerprint(f))),
  };
}

export function fingerprint(f: Finding): string {
  return [f.rule, f.file, f.line ?? 0, f.type].join("|");
}
