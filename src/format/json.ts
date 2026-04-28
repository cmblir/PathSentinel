// Machine-readable JSON formatter — same shape as the MCP tool result.

import type { ScanResult } from "../types.js";

export function formatJson(result: ScanResult): string {
  const payload =
    result.findings.length > 0
      ? result
      : {
          ...result,
          message:
            "No security issues found. Privacy-restricted paths were skipped (see summary.blockedByPrivacy).",
        };
  return JSON.stringify(payload, null, 2);
}
