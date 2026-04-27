# PathSentinel

A Model Context Protocol (MCP) server that scans local project paths for
hardcoded secrets, sensitive configuration files, and privacy-restricted
locations **before** their contents are exposed to a Large Language Model.

[![MCP](https://img.shields.io/badge/MCP-Supported-blue.svg)](https://modelcontextprotocol.io)
[![License](https://img.shields.io/badge/License-ISC-green.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org)
[![한국어](https://img.shields.io/badge/Docs-한국어-red.svg)](./README_KR.md)

---

## What it does

PathSentinel sits between your local filesystem and an LLM such as Claude.
When the model asks to inspect a project, the server walks the directory
under three guarantees:

1. **Privacy paths are never read.** Locations such as `~/.ssh/`, `~/.aws/`,
   shell history files, and TLS keys are excluded at the directory-walk
   layer. Their existence is counted in the summary; their bytes never
   reach memory.
2. **Sensitive config files are reported, not opened.** `.env`,
   `credentials.json`, `service-account.json`, and similar basenames are
   surfaced as findings without their contents being attached.
3. **Detected secrets are redacted.** When a secret pattern matches, the
   excerpt attached to the finding shows only the first 4 characters
   followed by `…[REDACTED]`.

## Detection rules

| Category | Examples | Severity |
| :--- | :--- | :--- |
| Secret prefixes | AWS (`AKIA`/`ASIA`), GitHub (`ghp_/gho_/ghu_/ghs_/ghr_`, `github_pat_`), Slack (`xox?-`), Stripe (`sk_live_/sk_test_`), Google (`AIza`), OpenAI (`sk-`/`sk-proj-`), Anthropic (`sk-ant-`) | High |
| Cryptographic material | `-----BEGIN ... PRIVATE KEY-----`, JWTs, GCP service-account JSON | High / Medium |
| Generic assignments | `password = "..."`, `api_key: "..."` (≥12 mixed-charset chars) | Medium |
| Sensitive basenames | `.env*`, `credentials.json`, `secrets.{yml,yaml}`, `firebase-adminsdk.json` | Medium |
| Privacy paths (blocked) | `**/.ssh/**`, `**/.aws/**`, `**/.gnupg/**`, `**/*.pem`, `**/*.key`, `**/.npmrc`, `**/.netrc`, shell history, OS keychains | Reported as count only — content never read |

The full lists live in [`src/patterns.ts`](./src/patterns.ts).

## Installation

```bash
git clone https://github.com/cmblir/PathSentinel.git
cd PathSentinel
npm install
npm run build
```

Requires Node.js **20 or newer**.

## Configuration

Replace `/absolute/path/to/PathSentinel` with the location where you cloned
the repository.

### Claude Desktop

Edit `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "path-sentinel": {
      "command": "node",
      "args": ["/absolute/path/to/PathSentinel/dist/index.js"]
    }
  }
}
```

### Claude Code (CLI)

```bash
claude mcp add path-sentinel node /absolute/path/to/PathSentinel/dist/index.js
```

Then ask the model:

> Use `path-sentinel` to scan the current directory for secrets and
> sensitive files.

## Tool: `scan_path`

**Input**

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `path` | string | yes | Absolute or relative path to a project, directory, or single file. |
| `followSymlinks` | boolean | no | Follow symlinks during traversal. Off by default to avoid loops. |

**Output** — JSON with `target`, `findings`, and `summary`:

```json
{
  "target": "/Users/me/project",
  "findings": [
    {
      "severity": "high",
      "type": "Hardcoded Secret",
      "rule": "AWS Access Key",
      "file": "/Users/me/project/src/legacy.js",
      "line": 12,
      "description": "Possible AWS Access Key detected (confidence: high).",
      "excerpt": "const KEY = \"AKIA…[REDACTED]\";"
    },
    {
      "severity": "medium",
      "type": "Sensitive File",
      "rule": "Sensitive Config",
      "file": "/Users/me/project/.env",
      "description": "Sensitive configuration file present: .env. File contents are NOT included in this report."
    }
  ],
  "summary": {
    "scannedFiles": 142,
    "skippedBinary": 17,
    "skippedLarge": 1,
    "blockedByPrivacy": 38,
    "durationMs": 184
  }
}
```

When no findings are produced, an extra `message` field is included so the
caller can distinguish a clean scan from an empty error.

## Programmatic use

The package also exports its scanner so you can embed it in scripts:

```ts
import { ProjectGuardian } from "path-sentinel";

const guardian = new ProjectGuardian({ followSymlinks: false });
const result = await guardian.scan("/path/to/project");
console.log(result.summary, result.findings);
```

## Limitations

- **Pattern-based detection.** PathSentinel does not perform entropy or AST
  analysis. Secrets without a recognisable prefix and below the 12-char
  threshold of the generic rule may slip through.
- **First match per line.** Multiple secrets on the same line may collapse
  into multiple findings but a single excerpt; verify with the line number.
- **Files larger than 1 MiB** are skipped to keep scans fast. Increase via
  `new ProjectGuardian({ maxFileBytes: ... })` when embedding.
- **No git history scan.** Only the current working tree is inspected.

## Development

```bash
npm install
npm run dev      # run from source via tsx
npm run build    # emit dist/
npm test         # node:test runner
```

Tests live in `src/__tests__/` and run against synthetic fixtures created
inside the OS temp directory; no real secrets are written or read.

## Troubleshooting

| Symptom | Likely cause | Fix |
| :--- | :--- | :--- |
| `Cannot find module ".../dist/index.js"` | Skipped `npm run build`. | Run `npm run build`. |
| Scan returns 0 findings on a known leaky repo | Privacy paths or `node_modules/` excluded by default. | Verify `summary.blockedByPrivacy` and `summary.skippedBinary`. |
| `Path does not exist` | Path is mistyped or relative to a different cwd. | Pass an absolute path. |
| Permission errors logged on stderr | Files unreadable to the current user. | Run with appropriate permissions; PathSentinel skips the file and continues. |

## Contributing

Issues and PRs are welcome — especially new high-precision detection rules
and false-positive fixes.

## License

ISC. See [LICENSE](./LICENSE).
