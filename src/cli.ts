// Standalone CLI entry point.
//
// Usage:
//   path-sentinel scan <path> [options]
//
// Exit codes:
//   0 — clean (no findings, or all findings in baseline)
//   1 — findings present (CI gate)
//   2 — invocation error (bad args, path missing, baseline unreadable)

import { ProjectGuardian } from "./scanner.js";
import { applyBaseline, loadBaseline } from "./baseline.js";
import {
  formatResult,
  SUPPORTED_FORMATS,
  type OutputFormat,
} from "./format/index.js";
import type { Severity } from "./types.js";
import { VERSION } from "./version.js";

interface ScanCommand {
  kind: "scan";
  path: string;
  format: OutputFormat;
  baselinePath?: string;
  followSymlinks: boolean;
  maxBytes?: number;
  severity?: Severity;
  color: boolean;
  quiet: boolean;
}

type Command =
  | ScanCommand
  | { kind: "help" }
  | { kind: "version" }
  | { kind: "error"; message: string };

const HELP_TEXT = `path-sentinel ${VERSION}

USAGE:
  path-sentinel                       Run as MCP server over stdio (default)
  path-sentinel mcp                   Run as MCP server over stdio (explicit)
  path-sentinel scan <path> [opts]    Scan a path and print findings
  path-sentinel --help | --version    Show this help / version

SCAN OPTIONS:
  --format <text|json|sarif>          Output format (default: text)
  --baseline <file>                   Ignore findings present in this prior JSON report
  --severity <high|medium|low>        Filter text output to >= this severity
  --follow-symlinks                   Follow symlinks during traversal
  --max-bytes <N>                     Per-file byte cap (default: 1048576)
  --no-color                          Disable ANSI colours
  --quiet                             Suppress summary line in text output

EXIT CODES:
  0  Clean: no findings, or every finding is in the baseline
  1  Findings present
  2  Invocation error (bad args, missing path, unreadable baseline)
`;

export async function runCli(argv: string[]): Promise<number> {
  const cmd = parse(argv);

  switch (cmd.kind) {
    case "help":
      process.stdout.write(HELP_TEXT);
      return 0;
    case "version":
      process.stdout.write(`${VERSION}\n`);
      return 0;
    case "error":
      process.stderr.write(`path-sentinel: ${cmd.message}\n`);
      process.stderr.write(`Run 'path-sentinel --help' for usage.\n`);
      return 2;
    case "scan":
      return runScan(cmd);
  }
}

async function runScan(cmd: ScanCommand): Promise<number> {
  let baseline: Set<string> | undefined;
  if (cmd.baselinePath) {
    try {
      baseline = await loadBaseline(cmd.baselinePath);
    } catch (err) {
      process.stderr.write(`path-sentinel: ${(err as Error).message}\n`);
      return 2;
    }
  }

  const guardian = new ProjectGuardian({
    followSymlinks: cmd.followSymlinks,
    maxFileBytes: cmd.maxBytes,
  });

  let result;
  try {
    result = await guardian.scan(cmd.path);
  } catch (err) {
    process.stderr.write(`path-sentinel: ${(err as Error).message}\n`);
    return 2;
  }

  const filtered = baseline ? applyBaseline(result, baseline) : result;

  const output = formatResult(filtered, cmd.format, {
    color: cmd.color,
    quiet: cmd.quiet,
    severityFilter: cmd.severity,
  });
  process.stdout.write(output);
  if (!output.endsWith("\n")) process.stdout.write("\n");

  return filtered.findings.length > 0 ? 1 : 0;
}

function parse(argv: string[]): Command {
  if (argv.length === 0) {
    return { kind: "error", message: "no subcommand given" };
  }

  const head = argv[0];
  if (head === "-h" || head === "--help") return { kind: "help" };
  if (head === "-v" || head === "--version") return { kind: "version" };
  if (head !== "scan") {
    return { kind: "error", message: `unknown subcommand: ${head}` };
  }

  const rest = argv.slice(1);
  let path: string | undefined;
  let format: OutputFormat = "text";
  let baselinePath: string | undefined;
  let followSymlinks = false;
  let maxBytes: number | undefined;
  let severity: Severity | undefined;
  let color = isTty(process.stdout);
  let quiet = false;

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    switch (arg) {
      case "--format": {
        const v = rest[++i];
        if (!v || !SUPPORTED_FORMATS.includes(v as OutputFormat)) {
          return {
            kind: "error",
            message: `--format expects one of ${SUPPORTED_FORMATS.join("|")}`,
          };
        }
        format = v as OutputFormat;
        break;
      }
      case "--baseline": {
        const v = rest[++i];
        if (!v) {
          return { kind: "error", message: "--baseline expects a file path" };
        }
        baselinePath = v;
        break;
      }
      case "--severity": {
        const v = rest[++i];
        if (v !== "high" && v !== "medium" && v !== "low") {
          return {
            kind: "error",
            message: "--severity expects high|medium|low",
          };
        }
        severity = v;
        break;
      }
      case "--follow-symlinks":
        followSymlinks = true;
        break;
      case "--max-bytes": {
        const v = rest[++i];
        const n = v ? Number(v) : Number.NaN;
        if (!Number.isFinite(n) || n <= 0) {
          return {
            kind: "error",
            message: "--max-bytes expects a positive integer",
          };
        }
        maxBytes = n;
        break;
      }
      case "--no-color":
        color = false;
        break;
      case "--quiet":
        quiet = true;
        break;
      case "-h":
      case "--help":
        return { kind: "help" };
      default:
        if (arg.startsWith("-")) {
          return { kind: "error", message: `unknown option: ${arg}` };
        }
        if (path !== undefined) {
          return { kind: "error", message: `unexpected positional: ${arg}` };
        }
        path = arg;
    }
  }

  if (path === undefined) {
    return { kind: "error", message: "scan requires a <path>" };
  }

  return {
    kind: "scan",
    path,
    format,
    baselinePath,
    followSymlinks,
    maxBytes,
    severity,
    color,
    quiet,
  };
}

function isTty(stream: NodeJS.WriteStream): boolean {
  return Boolean((stream as { isTTY?: boolean }).isTTY);
}
