<h1 align="center">PathSentinel</h1>

<p align="center">
  <b>LLM 시대를 위한 프라이버시 우선 시크릿 스캐너.</b><br/>
  하드코딩된 비밀, 민감 설정 파일, 개인 자격증명 경로가
  거대 언어 모델(LLM)에 도달하는 것을 사전에 차단합니다.
  MCP, CLI, pre-commit, GitHub Actions, Docker 다섯 진입점 지원.
</p>

<p align="center">
  <a href="https://modelcontextprotocol.io"><img src="https://img.shields.io/badge/MCP-Supported-blue.svg" alt="MCP"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg" alt="Node"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-ISC-green.svg" alt="License"></a>
  <a href="./README.md"><img src="https://img.shields.io/badge/Docs-English-blue.svg" alt="English docs"></a>
</p>

> 영문 정본은 [README.md](./README.md). 본 문서는 한국어 보조 번역본입니다.

---

## 목차

- [왜 PathSentinel인가](#왜-pathsentinel인가)
- [주요 기능](#주요-기능)
- [Quick Start](#quick-start)
- [설치](#설치)
  - [Claude Desktop / Claude Code (MCP)](#claude-desktop--claude-code-mcp)
  - [Standalone CLI](#standalone-cli)
  - [pre-commit framework](#pre-commit-framework)
  - [GitHub Action](#github-action)
  - [Docker](#docker)
- [사용법](#사용법)
- [탐지 규칙](#탐지-규칙)
- [출력 형식](#출력-형식)
- [다른 스캐너와의 비교](#다른-스캐너와의-비교)
- [FAQ](#faq)
- [한계](#한계)
- [개발](#개발)
- [기여](#기여)
- [라이선스](#라이선스)

---

## 왜 PathSentinel인가

LLM 코딩 에이전트(Claude Code, Cursor, Continue 등)는 응답을 생성하기 **전에**
파일시스템을 먼저 읽습니다. `read_file ~/.aws/credentials` 한 번,
`cat .env` 한 번이면 시크릿이 다음 위치로 흘러갑니다:

- 모델의 컨텍스트 윈도,
- 제공자의 요청 로그,
- 사후에 공유될 모든 대화 트랜스크립트.

기존 시크릿 스캐너(gitleaks, trufflehog)는 **커밋**과 **CI**를 중심으로
설계되었습니다. 코드가 이미 버전 관리에 들어간 후에 동작하지요.
PathSentinel은 그 이전 단계, 즉 **모델이 말을 꺼내기 전에 일어나는
디렉터리 워크** 자체를 보호합니다.

> **위협 모델**: 사용자의 홈 디렉터리에 읽기 권한을 가진, 호기심 많거나
> 손상된 AI 에이전트. PathSentinel은 네트워크가 아니라 **에이전트 자체를
> 적대적 경계**로 가정합니다.

## 주요 기능

- **프라이버시 우선 순회.** `~/.ssh/`, `~/.aws/`, `~/.gnupg/`, 셸 히스토리,
  TLS 키 같은 경로는 디렉터리 워크 단계에서 제외됩니다. 내용은
  **메모리에 절대 올라오지 않으며**, summary의 카운트로만 노출됩니다.
- **민감 설정 파일은 보고하되 열지 않습니다.** `.env`, `credentials.json`,
  `service-account.json` 같은 파일은 finding으로 surface하되 바이트는
  첨부하지 않습니다.
- **Excerpt는 redact됩니다.** 처음 4자만 노출하고 나머지는
  `…[REDACTED]`로 치환합니다. 전체 비밀이 스캐너를 떠나는 일은 없습니다.
- **5개 진입점, 단일 엔진.** MCP (stdio), Standalone CLI, pre-commit hook,
  GitHub Action, Docker 이미지 — 모두 동일한 `ProjectGuardian` 스캐너 공유.
- **3가지 출력 형식.** Human-readable text, machine-readable JSON,
  SARIF 2.1.0 (GitHub Code Scanning / GitLab SAST 호환).
- **Baseline / diff 모드.** 기존 finding을 모두 고치지 않고도 레거시 레포에
  점진적으로 도입 가능.
- **부수효과 없음.** 네트워크 호출, 텔레메트리, 설정 파일 쓰기, 캐시
  생성 일체 없음. 순수 read-only 검사.

## Quick Start

```bash
git clone https://github.com/cmblir/PathSentinel.git
cd PathSentinel
npm install && npm run build
```

CLI로 사용:

```bash
node dist/index.js scan .
```

또는 Claude Code에 등록:

```bash
claude mcp add path-sentinel node "$(pwd)/dist/index.js"
```

모델에 요청:

> path-sentinel으로 현재 디렉터리를 스캔해서, 이 레포를 공유하기 전에
> 새어 나갈 만한 게 있는지 알려줘.

## 설치

### 사전 요구사항

- Node.js **20 이상** (CLI / MCP 설치 시)
- Docker (Docker 설치 시)
- `pre-commit` framework (pre-commit 설치 시)

### 소스에서 빌드

```bash
git clone https://github.com/cmblir/PathSentinel.git
cd PathSentinel
npm install
npm run build
```

### Claude Desktop / Claude Code (MCP)

#### Claude Desktop

`claude_desktop_config.json` 편집:

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

stdio 기반 MCP를 말하는 모든 클라이언트가 동일하게 동작하며 `scan_path`
도구가 자동 노출됩니다.

### Standalone CLI

```bash
node dist/index.js scan <path> [options]

# 또는 `npm install -g .` 후:
path-sentinel scan <path> [options]
```

옵션: `--format text|json|sarif`, `--baseline <file>`,
`--severity high|medium|low`, `--follow-symlinks`, `--max-bytes <N>`,
`--no-color`, `--quiet`, `--help`, `--version`.

종료 코드: **0** clean, **1** finding 존재 (CI 게이트), **2** invocation
오류.

### pre-commit framework

`.pre-commit-config.yaml`에 추가:

```yaml
repos:
  - repo: https://github.com/cmblir/PathSentinel
    rev: v1.1.0
    hooks:
      - id: path-sentinel
```

훅은 staged 파일만이 아니라 working tree 전체를 스캔하므로 프라이버시
경로와 민감 베이스네임을 놓치지 않습니다.

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

입력: `path`, `format`, `baseline`, `severity`, `output`, `fail-on-findings`.
출력: `findings-count`, `report-path`.

### Docker

```bash
docker build -t path-sentinel .

# 현재 디렉터리 스캔 (read-only 마운트):
docker run --rm -v "$PWD:/scan:ro" path-sentinel /scan

# 다운스트림 도구용 SARIF 출력:
docker run --rm -v "$PWD:/scan:ro" path-sentinel /scan --format sarif

# stdio 기반 MCP 서버로 실행:
docker run --rm -i path-sentinel mcp
```

## 사용법

### MCP 도구로

| 도구 | 설명 |
| :--- | :--- |
| `scan_path` | 프로젝트 경로에서 하드코딩 시크릿, 민감 설정 파일, 프라이버시 차단 경로를 스캔. |

**입력 파라미터**

| 필드 | 타입 | 필수 | 기본값 | 설명 |
| :--- | :--- | :--- | :--- | :--- |
| `path` | string | 예 | — | 스캔할 프로젝트·디렉터리·단일 파일의 절대 또는 상대 경로. |
| `followSymlinks` | boolean | 아니오 | `false` | 심볼릭 링크 추적 여부. 기본값 false. |

### CLI로

```bash
# TTY 컬러 자동 적용된 텍스트 스캔
path-sentinel scan ./repo

# 후속 처리를 위한 JSON
path-sentinel scan ./repo --format json --quiet

# GitHub Code Scanning용 SARIF
path-sentinel scan ./repo --format sarif > report.sarif

# 레거시 레포에 점진적 도입
path-sentinel scan ./repo --format json --quiet > baseline.json
# ...나중에...
path-sentinel scan ./repo --baseline baseline.json
```

### 프로그래밍 사용

```ts
import { ProjectGuardian, formatResult } from "path-sentinel";

const guardian = new ProjectGuardian({ followSymlinks: false });
const result = await guardian.scan("/path/to/project");

console.log(formatResult(result, "sarif", { color: false, quiet: true }));
```

### 사용 예시

```
> path-sentinel으로 ./demo를 스캔해줘

3 findings
  [high]   AWS Access Key       demo/src/legacy.js:12
        const KEY = "AKIA…[REDACTED]";
  [medium] Sensitive Config     demo/.env
  [medium] OpenAI API Key       demo/scripts/oneoff.ts:4
        const oai = "sk-…[REDACTED]";

target=demo  scanned=142  binary=17  large=1  privacy_blocked=38  184ms
```

## 탐지 규칙

| 카테고리 | 예시 | 위험도 |
| :--- | :--- | :--- |
| 클라우드 시크릿 | AWS (`AKIA`/`ASIA`), GitHub (`ghp_/gho_/ghu_/ghs_/ghr_`, `github_pat_`), Slack (`xox?-`), Stripe (`sk_live_/sk_test_`), Google (`AIza`) | High |
| LLM 제공자 키 | OpenAI (`sk-`, `sk-proj-`), Anthropic (`sk-ant-`) | High / Medium |
| 암호화 자료 | `-----BEGIN ... PRIVATE KEY-----`, JWT, GCP service-account JSON | High / Medium |
| 일반 할당 | `password = "..."`, `api_key: "..."` (12자 이상 혼합 문자) | Medium |
| 민감 베이스네임 | `.env*`, `credentials.json`, `secrets.{yml,yaml}`, `firebase-adminsdk.json` | Medium |
| 프라이버시 경로 (차단) | `**/.ssh/**`, `**/.aws/**`, `**/.gnupg/**`, `**/*.pem`, `**/*.key`, `**/.npmrc`, `**/.netrc`, 셸 히스토리, OS 키체인 | 카운트만 보고 — 내용은 절대 읽지 않음 |

전체 목록은 [`src/patterns.ts`](./src/patterns.ts) 참조.

## 출력 형식

### JSON / MCP 도구 결과

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

findings가 비었을 때는 `message` 필드가 추가되어 깨끗한 스캔과 빈 오류를
구분할 수 있습니다.

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

위험도 매핑: high → `error`, medium → `warning`, low → `note`.

## 다른 스캐너와의 비교

| | PathSentinel | gitleaks | trufflehog | detect-secrets |
| :--- | :---: | :---: | :---: | :---: |
| LLM / MCP 컨텍스트 전용 설계 | yes | no | no | no |
| `~/.ssh`, `~/.aws` 읽기 차단 | yes | no | no | no |
| `.env`를 내용 노출 없이 보고 | yes | partial | partial | partial |
| 출력 전 excerpt redact | yes | no | no | partial |
| SARIF 2.1.0 출력 | yes | yes | yes | no |
| pre-commit / GitHub Action 제공 | yes | yes | yes | yes |
| Git 히스토리 스캔 | no | yes | yes | no |
| 자격증명 라이브 검증 | no | no | yes | no |
| 엔트로피 / AST 분석 | no | yes | yes | yes |
| 런타임 | Node ≥20 | Go binary | Go binary | Python |

PathSentinel과 gitleaks/trufflehog은 보완재입니다. CI에서 커밋 그래프
검사는 gitleaks/trufflehog로, 로컬 파일시스템과 AI 에이전트 사이의 게이트는
PathSentinel로 사용하세요.

## FAQ

**Q. git 히스토리도 스캔하나요?**
아니요. 현재 working tree만 검사합니다. 히스토리 스캔은 gitleaks 또는
trufflehog을 사용하세요.

**Q. 엔트로피 탐지가 없는 이유는?**
엔트로피는 false positive가 많습니다. 출력이 LLM에 의해 읽힐 때 정확히
피해야 할 특성이라 PathSentinel은 의도적으로 정밀도 높은 규칙에
집중합니다.

**Q. `node_modules/`가 제외되는 이유는?**
성능과 노이즈 때문입니다. 의존성도 검사하려면 `extraIgnore: []`로
오버라이드하세요.

**Q. 에이전트가 느려지진 않나요?**
일반적인 50,000개 파일 레포가 최신 노트북에서 1초 미만으로 스캔됩니다.

**Q. MCP 외에서도 사용할 수 있나요?**
예 — 5가지 방법. Standalone CLI (`path-sentinel scan`), pre-commit hook,
GitHub Action, Docker 이미지, 그리고 export된 `ProjectGuardian` 클래스를
통한 모든 Node 스크립트.

**Q. `$HOME`에 실행해도 안전한가요?**
예 — 명시적 설계 목표입니다. 프라이버시 경로는 어떤 바이트도 읽기 전에
필터링됩니다. summary의 0이 아닌 `blockedByPrivacy` 카운트가 그 증거입니다.

## 한계

- **패턴 기반 탐지**. 엔트로피·AST 분석은 수행하지 않습니다.
- **줄당 첫 매치**. excerpt는 단일 매치 기준이므로 line 번호로 확인하세요.
- **1 MiB 초과 파일은 스킵**. `new ProjectGuardian({ maxFileBytes: ... })`로
  조정 가능.
- **Working tree 전용**. git 히스토리, 원격, 바이너리 산출물은 검사하지
  않습니다.
- **stdio MCP 전송만 지원** (현재). Streamable HTTP transport는 로드맵에
  있습니다.

## 개발

```bash
npm install
npm run dev      # tsx로 소스에서 실행
npm run build    # dist/ 산출
npm test         # 합성 fixture에 대해 node:test 러너 실행
```

테스트는 `src/__tests__/`에 위치하며 OS temp 디렉터리에 fixture를 만들어
동작합니다. 실제 시크릿은 작성·읽기 모두 발생하지 않습니다.

프로젝트 구조:

```
.
├── action.yml                # GitHub Action 메타데이터
├── Dockerfile                # 멀티-스테이지 컨테이너 빌드
├── .pre-commit-hooks.yaml    # pre-commit framework 훅 정의
└── src/
    ├── index.ts              # 엔트리 포인트 — argv 디스패치 + public API
    ├── server.ts             # MCP wiring (stdio transport)
    ├── scanner.ts            # ProjectGuardian — 순회 + 콘텐츠 매칭
    ├── patterns.ts           # 탐지 규칙 (privacy / sensitive / secrets)
    ├── types.ts              # 도메인 타입
    ├── version.ts            # VERSION 단일 진실 출처
    ├── cli.ts                # Standalone CLI 디스패처
    ├── baseline.ts           # Baseline / diff 지원
    ├── format/
    │   ├── index.ts          # Formatter 디스패치
    │   ├── text.ts           # Human-readable 터미널 출력
    │   ├── json.ts           # JSON (MCP 도구 결과와 동일 shape)
    │   └── sarif.ts          # SARIF 2.1.0
    └── __tests__/            # node:test 스위트
```

## 기여

이슈와 PR 환영합니다 — 특히:

- 정밀도 높은 새 탐지 규칙 (샘플 라인과 공식 포맷 스펙 인용 첨부).
- false positive 보고 (재현 케이스 포함).
- 추가 어댑터와 통합.

PR을 열기 전에 `npm test`와 `npm run build`를 실행하세요.

## 라이선스

[ISC](./LICENSE).
