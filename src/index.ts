#!/usr/bin/env node
// PathSentinel — entry point.
//
// All logic lives in dedicated modules:
//   - patterns.ts     → detection rules
//   - scanner.ts      → traversal + content matching
//   - server.ts       → MCP wiring (stdio transport)
//   - cli.ts          → standalone CLI dispatcher
//   - format/         → text / json / sarif formatters
//   - baseline.ts     → diff mode against a prior JSON report
//
// This file only handles argv dispatch and re-exports the public API
// for programmatic consumers.
//
// Dispatch rules:
//   no args              → MCP stdio (back-compat default)
//   "mcp"                → MCP stdio (explicit)
//   "scan", "--help",
//   "--version", etc.    → standalone CLI

import { fileURLToPath } from "node:url";

import { runCli } from "./cli.js";
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
export { runCli } from "./cli.js";
export {
  formatResult,
  SUPPORTED_FORMATS,
  type OutputFormat,
  type FormatOptions,
} from "./format/index.js";
export { loadBaseline, applyBaseline, fingerprint } from "./baseline.js";
export { VERSION } from "./version.js";

// Run as a binary when invoked directly, not when imported.
const isDirectInvocation =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectInvocation) {
  const argv = process.argv.slice(2);
  const head = argv[0];

  if (head === undefined || head === "mcp") {
    startStdio().catch((error) => {
      console.error("[path-sentinel] fatal:", error);
      process.exit(1);
    });
  } else {
    runCli(argv)
      .then((code) => process.exit(code))
      .catch((error) => {
        console.error("[path-sentinel] fatal:", error);
        process.exit(2);
      });
  }
}
