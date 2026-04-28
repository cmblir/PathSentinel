// Format dispatch — pick a formatter by name.

import type { ScanResult, Severity } from "../types.js";
import { formatJson } from "./json.js";
import { formatSarif } from "./sarif.js";
import { formatText, type TextFormatOptions } from "./text.js";

export type OutputFormat = "text" | "json" | "sarif";

export const SUPPORTED_FORMATS: readonly OutputFormat[] = [
  "text",
  "json",
  "sarif",
];

export interface FormatOptions {
  color: boolean;
  quiet: boolean;
  severityFilter?: Severity;
  cwd?: string;
}

export function formatResult(
  result: ScanResult,
  format: OutputFormat,
  opts: FormatOptions,
): string {
  switch (format) {
    case "json":
      return formatJson(result);
    case "sarif":
      return formatSarif(result);
    case "text": {
      const textOpts: TextFormatOptions = {
        color: opts.color,
        quiet: opts.quiet,
        severityFilter: opts.severityFilter,
        cwd: opts.cwd,
      };
      return formatText(result, textOpts);
    }
  }
}
