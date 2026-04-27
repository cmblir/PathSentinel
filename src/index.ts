#!/usr/bin/env node
// PathSentinel — MCP server entry point.
//
// All logic lives in dedicated modules:
//   - patterns.ts → detection rules
//   - scanner.ts  → traversal + content matching
//   - server.ts   → MCP wiring
//
// This file only handles the CLI bootstrap and re-exports the public API
// for programmatic consumers.

import { fileURLToPath } from "node:url";
import { startStdio } from "./server.js";

export { ProjectGuardian, type ScannerOptions } from "./scanner.js";
export {
  PRIVACY_DENY_LIST,
  SECRET_PATTERNS,
  SENSITIVE_FILES,
  BINARY_EXTENSIONS,
  type SecretRule,
} from "./patterns.js";
export type {
  Finding,
  FindingType,
  ScanResult,
  ScanSummary,
  Severity,
} from "./types.js";
export { createServer, startStdio } from "./server.js";

// Run as a binary when invoked directly, not when imported.
const isDirectInvocation =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectInvocation) {
  startStdio().catch((error) => {
    console.error("[path-sentinel] fatal:", error);
    process.exit(1);
  });
}
