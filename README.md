<h1 align="center">PathSentinel</h1>

<p align="center">
  <b>Privacy-first secret scanner for the LLM era.</b><br/>
  Stops hardcoded secrets, sensitive config files, and personal credential paths
  from ever reaching a Large Language Model — through MCP, CLI, pre-commit,
  GitHub Actions, or Docker.
</p>

<p align="center">
  <a href="https://modelcontextprotocol.io"><img src="https://img.shields.io/badge/MCP-Supported-blue.svg" alt="MCP"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg" alt="Node"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-ISC-green.svg" alt="License"></a>
  <a href="./README_KR.md"><img src="https://img.shields.io/badge/Docs-한국어-red.svg" alt="Korean docs"></a>
</p>

---

## Table of Contents

- [Why PathSentinel?](#why-pathsentinel)
- [Features](#features)
- [Quick Start](#quick-start)
- [Installation](#installation)
  - [Claude Desktop / Claude Code (MCP)](#claude-desktop--claude-code-mcp)
  - [Standalone CLI](#standalone-cli)
  - [pre-commit framework](#pre-commit-framework)
  - [GitHub Action](#github-action)
  - [Docker](#docker)
- [Usage](#usage)
- [Detection Rules](#detection-rules)
- [Output Formats](#output-formats)
- [Comparison](#comparison-with-other-scanners)
- [FAQ](#faq)
- [Limitations](#limitations)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

---

## Why PathSentinel?

LLM coding agents (Claude Code, Cursor, Continue, etc.) read your filesystem
**before** they generate anything. A single careless `read_file ~/.aws/credentials`
or `cat .env` ends with your secret in:

- the model's context window,
- the provider's request logs,
- and any conversation transcript shared after the fact.

Traditional secret scanners (gitleaks, trufflehog) are built around **commits**
and **CI**. They run after the code is already in version control. PathSentinel
is built around the **directory walk that happens before the model speaks** —
its job is to make sure the bytes never enter the prompt in the first place.

> **Threat model**: a curious or compromised AI agent that has read access to
> your home directory. PathSentinel assumes the agent is the adversary boundary,
> not the network.

## Features

- **Privacy-first traversal.** Paths like `~/.ssh/`, `~/.aws/`, `~/.gnupg/`,
  shell history, and TLS keys are excluded at the directory-walk layer. Their
  contents are **never read into memory** — only counted in the summary.
- **Sensitive config files reported, not opened.** `.env`, `credentials.json`,
  `service-account.json`, and friends surface as findings without their bytes
  attached.
- **Redacted excerpts.** When a secret pattern matches, only the first 4
  characters appear; the rest is replaced with `…[REDACTED]`. The full secret
  never leaves the scanner.
- **Five entry points, one engine.** MCP (stdio), standalone CLI, pre-commit
  hook, GitHub Action, Docker image — all share the same `ProjectGuardian`
  scanner.
- **Three output formats.** Human-readable text, machine-readable JSON, and
  SARIF 2.1.0 for GitHub Code Scanning / GitLab SAST.
- **Baseline / diff mode.** Adopt PathSentinel on a legacy repo without fixing
  every existing finding before the gate goes green.
- **Zero side-effects.** No network calls, no telemetry, no config files
  written, no caches created. Pure read-only inspection.

## Quick Start

```bash
git clone https://github.com/cmblir/PathSentinel.git
cd PathSentinel
npm install && npm run build
```

Use it as a CLI:

```bash
node dist/index.js scan .
```

Or wire it into Claude Code:

```bash
claude mcp add path-sentinel node "$(pwd)/dist/index.js"
```

Then ask the model:

> Use `path-sentinel` to scan the current directory and tell me if anything
> sensitive would leak before I share this repo.

## Installation

### Prerequisites

- Node.js **20 or newer** (CLI / MCP installs)
- Docker (Docker install)
- `pre-commit` framework (pre-commit install)

### Build from source

```bash
git clone https://github.com/cmblir/PathSentinel.git
cd PathSentinel
npm install
npm run build
```

### Claude Desktop / Claude Code (MCP)

#### Claude Desktop

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

#### Claude Code (CLI)

```bash
claude mcp add path-sentinel node /absolute/path/to/PathSentinel/dist/index.js
```

Any MCP client that speaks stdio works the same way — the `scan_path` tool
will appear automatically.

### Standalone CLI

```bash
node dist/index.js scan <path> [options]

# or, after `npm install -g .`:
path-sentinel scan <path> [options]
```

Options: `--format text|json|sarif`, `--baseline <file>`,
`--severity high|medium|low`, `--follow-symlinks`, `--max-bytes <N>`,
`--no-color`, `--quiet`, `--help`, `--version`.

Exit codes: **0** clean, **1** findings present (CI gate), **2** invocation
error.

### pre-commit framework

Add to your `.pre-commit-config.yaml`:

```yaml
repos:
  - repo: https://github.com/cmblir/PathSentinel
    rev: v1.1.0
    hooks:
      - id: path-sentinel
```

The hook scans the working tree (not just staged files) so privacy paths and
sensitive basenames are caught.

### GitHub Action

```yaml
# .github/workflows/secrets.yml
name: PathSentinel
on: [push, pull_request]
jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: cmblir/PathSentinel@v1.1.0
        id: ps
        with:
          path: '.'
          format: 'sarif'
          output: 'pathsentinel.sarif'
          fail-on-findings: 'true'
      - if: always()
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: 'pathsentinel.sarif'
```

Inputs: `path`, `format`, `baseline`, `severity`, `output`, `fail-on-findings`.
Outputs: `findings-count`, `report-path`.

### Docker

```bash
docker build -t path-sentinel .

# Scan the current directory (read-only mount):
docker run --rm -v "$PWD:/scan:ro" path-sentinel /scan

# Emit SARIF for downstream tools:
docker run --rm -v "$PWD:/scan:ro" path-sentinel /scan --format sarif

# Run as MCP server over stdio:
docker run --rm -i path-sentinel mcp
```

## Usage

### As an MCP tool

The server exposes a single tool:

| Tool | Description |
| :--- | :--- |
| `scan_path` | Scan a project path for hardcoded secrets, sensitive config files, and privacy-restricted paths. |

**Input parameters**

| Field | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `path` | string | yes | — | Absolute or relative path to a project, directory, or single file. |
| `followSymlinks` | boolean | no | `false` | Follow symlinks during traversal. Off by default to avoid loops. |

### As a CLI

```bash
# Plain text scan with TTY-aware colours
path-sentinel scan ./repo

# JSON for further processing
path-sentinel scan ./repo --format json --quiet

# SARIF for GitHub Code Scanning
path-sentinel scan ./repo --format sarif > report.sarif

# Adopt incrementally on a legacy repo
path-sentinel scan ./repo --format json --quiet > baseline.json
# ...later...
path-sentinel scan ./repo --baseline baseline.json
```

### Programmatic

```ts
import { ProjectGuardian, formatResult } from "path-sentinel";

const guardian = new ProjectGuardian({ followSymlinks: false });
const result = await guardian.scan("/path/to/project");

console.log(formatResult(result, "sarif", { color: false, quiet: true }));
```

### Example session

```
> Use path-sentinel to scan ./demo

3 findings
  [high]   AWS Access Key       demo/src/legacy.js:12
        const KEY = "AKIA…[REDACTED]";
  [medium] Sensitive Config     demo/.env
  [medium] OpenAI API Key       demo/scripts/oneoff.ts:4
        const oai = "sk-…[REDACTED]";

target=demo  scanned=142  binary=17  large=1  privacy_blocked=38  184ms
```

## Detection Rules

| Category | Examples | Severity |
| :--- | :--- | :--- |
| Cloud secrets | AWS (`AKIA`/`ASIA`), GitHub (`ghp_/gho_/ghu_/ghs_/ghr_`, `github_pat_`), Slack (`xox?-`), Stripe (`sk_live_/sk_test_`), Google (`AIza`) | High |
| LLM provider keys | OpenAI (`sk-`, `sk-proj-`), Anthropic (`sk-ant-`) | High / Medium |
| Cryptographic material | `-----BEGIN ... PRIVATE KEY-----`, JWTs, GCP service-account JSON | High / Medium |
| Generic assignments | `password = "..."`, `api_key: "..."` (≥12 mixed-charset chars) | Medium |
| Sensitive basenames | `.env*`, `credentials.json`, `secrets.{yml,yaml}`, `firebase-adminsdk.json` | Medium |
| Privacy paths (blocked) | `**/.ssh/**`, `**/.aws/**`, `**/.gnupg/**`, `**/*.pem`, `**/*.key`, `**/.npmrc`, `**/.netrc`, shell history, OS keychains | Reported as count only — content is never read |

The full lists live in [`src/patterns.ts`](./src/patterns.ts).

## Output Formats

### JSON / MCP tool result

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

When no findings are produced, an additional `message` field is included so
the caller can distinguish a clean scan from an empty error.

### SARIF 2.1.0

```json
{
  "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
  "version": "2.1.0",
  "runs": [{
    "tool": {
      "driver": {
        "name": "PathSentinel",
        "version": "1.1.0",
        "informationUri": "https://github.com/cmblir/PathSentinel",
        "rules": [{ "id": "AWS Access Key", "name": "AWS Access Key", "...": "..." }]
      }
    },
    "results": [{
      "ruleId": "AWS Access Key",
      "level": "error",
      "message": { "text": "Possible AWS Access Key detected (confidence: high)." },
      "locations": [{
        "physicalLocation": {
          "artifactLocation": { "uri": "file:///Users/me/project/src/legacy.js" },
          "region": { "startLine": 12 }
        }
      }]
    }]
  }]
}
```

Severity mapping: high → `error`, medium → `warning`, low → `note`.

## Comparison with Other Scanners

| | PathSentinel | gitleaks | trufflehog | detect-secrets |
| :--- | :---: | :---: | :---: | :---: |
| Designed for LLM / MCP context | yes | no | no | no |
| Blocks reading of `~/.ssh`, `~/.aws` | yes | no | no | no |
| Reports `.env` without exposing contents | yes | partial | partial | partial |
| Excerpts redacted before output | yes | no | no | partial |
| SARIF 2.1.0 output | yes | yes | yes | no |
| pre-commit / GitHub Action shipped | yes | yes | yes | yes |
| Git history scanning | no | yes | yes | no |
| Live verification of credentials | no | no | yes | no |
| Entropy / AST analysis | no | yes | yes | yes |
| Runtime | Node ≥20 | Go binary | Go binary | Python |

PathSentinel and gitleaks/trufflehog are complementary. Use gitleaks/trufflehog
in CI on the commit graph; use PathSentinel as the guard between your local
filesystem and any AI agent that can read it.

## FAQ

**Q. Does it scan git history?**
No. PathSentinel only looks at the current working tree. For history scans use
gitleaks or trufflehog.

**Q. Why no entropy detection?**
Entropy is great for unknown secret formats but produces a noisy stream of
false positives, which is the opposite of what you want when the output is
read by an LLM. PathSentinel deliberately leans on high-precision rules.

**Q. Why is `node_modules/` excluded?**
Performance and noise. Most credential leaks in `node_modules/` are test
fixtures inside published packages, not real secrets. Override with
`extraIgnore: []` if you need to inspect dependencies.

**Q. Will it slow my agent down?**
A typical 50k-file repo scans in well under a second on a modern laptop.
Files larger than 1 MiB and binary extensions are skipped by default.

**Q. Can it run outside MCP?**
Yes — five ways. Standalone CLI (`path-sentinel scan`), pre-commit hook,
GitHub Action, Docker image, and any Node script via the exported
`ProjectGuardian` class.

**Q. Is it safe to run on `$HOME`?**
Yes — that is the explicit design goal. Privacy paths are filtered before
any byte is read. The summary will report a non-zero `blockedByPrivacy`
count, which is the proof.

## Limitations

- **Pattern-based detection.** No entropy or AST analysis. Secrets without a
  recognisable prefix and below the 12-char threshold of the generic rule
  may slip through.
- **First match per line.** Multiple secrets on the same line may surface as
  separate findings but share a single excerpt; verify with the line number.
- **Files larger than 1 MiB are skipped** to keep scans fast. Override with
  `new ProjectGuardian({ maxFileBytes: ... })`.
- **Working tree only.** No git history, no remote, no binary artefacts.
- **stdio-only MCP transport** today. Streamable HTTP transport is on the
  roadmap.

## Development

```bash
npm install
npm run dev      # run from source via tsx
npm run build    # emit dist/
npm test         # node:test runner against synthetic fixtures
```

Tests live in `src/__tests__/` and run against fixtures created inside the
OS temp directory; no real secrets are written or read.

Project layout:

```
.
├── action.yml                # GitHub Action metadata
├── Dockerfile                # Multi-stage container build
├── .pre-commit-hooks.yaml    # pre-commit framework hook definition
└── src/
    ├── index.ts              # Entry point — argv dispatch + public API
    ├── server.ts             # MCP wiring (stdio transport)
    ├── scanner.ts            # ProjectGuardian — traversal + content matching
    ├── patterns.ts           # Detection rules (privacy / sensitive / secrets)
    ├── types.ts              # Domain types
    ├── version.ts            # Single source of truth for VERSION
    ├── cli.ts                # Standalone CLI dispatcher
    ├── baseline.ts           # Baseline / diff support
    ├── format/
    │   ├── index.ts          # Formatter dispatch
    │   ├── text.ts           # Human-readable terminal output
    │   ├── json.ts           # JSON (matches MCP tool result)
    │   └── sarif.ts          # SARIF 2.1.0
    └── __tests__/            # node:test suites
```

## Contributing

Issues and PRs are welcome — especially:

- New high-precision detection rules (please include a sample line and a
  citation to the official format spec).
- False-positive reports with a reproducer.
- Additional adapters and integrations.

Run `npm test` and `npm run build` before opening a PR.

## License

[ISC](./LICENSE).
