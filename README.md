<h1 align="center">PathSentinel</h1>

<p align="center">
  <b>Privacy-first secret scanner for the LLM era.</b><br/>
  Stops hardcoded secrets, sensitive config files, and personal credential paths
  from ever reaching a Large Language Model.
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
- [Usage](#usage)
- [Detection Rules](#detection-rules)
- [Output Schema](#output-schema)
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
- **Stable, structured output.** JSON with stable severity / rule labels so
  graders, CI, and downstream tools can assert on results.
- **Zero side-effects.** No network calls, no telemetry, no config files
  written, no caches created. Pure read-only inspection.
- **Built for MCP.** Drop-in tool for Claude Desktop, Claude Code, and any
  Model Context Protocol client.

## Quick Start

```bash
git clone https://github.com/cmblir/PathSentinel.git
cd PathSentinel
npm install && npm run build
```

Then point Claude Code at it:

```bash
claude mcp add path-sentinel node "$(pwd)/dist/index.js"
```

Ask the model:

> Use `path-sentinel` to scan the current directory and tell me if anything
> sensitive would leak before I share this repo.

## Installation

### Prerequisites

- Node.js **20 or newer**
- npm (or any compatible package manager)

### Build from source

```bash
git clone https://github.com/cmblir/PathSentinel.git
cd PathSentinel
npm install
npm run build
```

### Wire it into a client

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

#### Other MCP clients

Any client that speaks MCP over stdio works. Point it at
`node /absolute/path/to/PathSentinel/dist/index.js` and the `scan_path` tool
will appear.

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
| `followSymlinks` | boolean | no | `false` | Follow symlinks during traversal. Off by default to avoid loops and to prevent escape into unrelated trees. |

### Programmatic

```ts
import { ProjectGuardian } from "path-sentinel";

const guardian = new ProjectGuardian({
  followSymlinks: false,
  maxFileBytes: 1024 * 1024, // 1 MiB
  extraIgnore: ["**/legacy/**"],
});

const result = await guardian.scan("/path/to/project");
console.log(result.summary);
for (const finding of result.findings) {
  console.log(`[${finding.severity}] ${finding.rule} @ ${finding.file}`);
}
```

### Example session

```
> Use path-sentinel to scan ./demo

Found 3 issues:
  [high]   AWS Access Key       demo/src/legacy.js:12
  [medium] Sensitive Config     demo/.env
  [medium] OpenAI API Key       demo/scripts/oneoff.ts:4

Summary: 142 files scanned, 17 binary skipped, 38 paths blocked by privacy rules (184 ms)
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

## Output Schema

Every successful scan returns the same JSON shape:

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

When no findings are produced, an additional `message` field is included so
the caller can distinguish a clean scan from an empty error.

## Comparison with Other Scanners

| | PathSentinel | gitleaks | trufflehog | detect-secrets |
| :--- | :---: | :---: | :---: | :---: |
| Designed for LLM / MCP context | yes | no | no | no |
| Blocks reading of `~/.ssh`, `~/.aws` | yes | no | no | no |
| Reports `.env` without exposing contents | yes | partial | partial | partial |
| Excerpts redacted before output | yes | no | no | partial |
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
The `ProjectGuardian` class is exported and has no MCP dependencies, so you
can use it from any Node script today. Standalone CLI / GitHub Action /
pre-commit integrations are on the roadmap.

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
- **stdio-only transport** today. Streamable HTTP transport is on the roadmap.

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
src/
├── index.ts      # CLI bootstrap + public API re-exports
├── server.ts     # MCP wiring (stdio transport, tool registration)
├── scanner.ts    # ProjectGuardian — traversal + content matching
├── patterns.ts   # Detection rules (privacy / sensitive / secrets)
├── types.ts      # Domain types
└── __tests__/    # node:test suites
```

## Contributing

Issues and PRs are welcome — especially:

- New high-precision detection rules (please include a sample line and a
  citation to the official format spec).
- False-positive reports with a reproducer.
- Additional adapters (CLI subcommand, GitHub Action, Docker image, SARIF
  output — see the [project issues](https://github.com/cmblir/PathSentinel/issues)).

Run `npm test` and `npm run build` before opening a PR.

## License

[ISC](./LICENSE).
