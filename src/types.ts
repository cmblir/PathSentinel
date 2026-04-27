// Core domain types for PathSentinel scan results.

export type Severity = "high" | "medium" | "low";

export type FindingType =
  | "Hardcoded Secret"
  | "Sensitive File"
  | "Privacy Path";

export interface Finding {
  severity: Severity;
  type: FindingType;
  /** Pattern or rule label that produced this finding (e.g. "AWS Access Key"). */
  rule: string;
  /** Absolute file path where the issue was detected. */
  file: string;
  /** Human-readable explanation. */
  description: string;
  /** 1-based line number when applicable. */
  line?: number;
  /** Redacted excerpt. Never includes full secret material. */
  excerpt?: string;
}

export interface ScanSummary {
  scannedFiles: number;
  skippedBinary: number;
  skippedLarge: number;
  blockedByPrivacy: number;
  durationMs: number;
}

export interface ScanResult {
  target: string;
  findings: Finding[];
  summary: ScanSummary;
}
