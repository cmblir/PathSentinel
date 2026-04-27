# PathSentinel (패스센티널)

로컬 프로젝트의 하드코딩된 비밀, 민감 설정 파일, 개인정보 경로를 LLM에
**전달되기 전에** 탐지하는 Model Context Protocol(MCP) 서버.

[![MCP](https://img.shields.io/badge/MCP-Supported-blue.svg)](https://modelcontextprotocol.io)
[![License](https://img.shields.io/badge/License-ISC-green.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)](https://nodejs.org)
[![English](https://img.shields.io/badge/Docs-English-blue.svg)](./README.md)

> 영문 정본은 [README.md](./README.md). 본 문서는 보조 번역본입니다.

---

## 무엇을 하는가

PathSentinel은 로컬 파일시스템과 Claude 같은 LLM 사이에서 게이트 역할을
합니다. 모델이 프로젝트를 살피려 할 때, 서버는 다음 세 가지 보장 아래
디렉터리를 순회합니다.

1. **개인정보 경로는 절대 읽지 않는다.** `~/.ssh/`, `~/.aws/`, 셸 히스토리,
   TLS 키 같은 위치는 디렉터리 워크 단계에서 제외됩니다. 존재 사실은
   summary 카운트로만 노출되고 바이트는 메모리에 올라오지 않습니다.
2. **민감 설정 파일은 보고하되 열지 않는다.** `.env`,
   `credentials.json`, `service-account.json` 같은 베이스네임은 finding으로
   surface하되 내용은 첨부하지 않습니다.
3. **탐지된 비밀은 redact한다.** 비밀 패턴이 매치되면 finding의 excerpt는
   첫 4자만 노출하고 나머지를 `…[REDACTED]`로 치환합니다.

## 탐지 규칙

| 카테고리 | 예시 | 위험도 |
| :--- | :--- | :--- |
| 비밀 prefix | AWS (`AKIA`/`ASIA`), GitHub (`ghp_/gho_/ghu_/ghs_/ghr_`, `github_pat_`), Slack (`xox?-`), Stripe (`sk_live_/sk_test_`), Google (`AIza`), OpenAI (`sk-`/`sk-proj-`), Anthropic (`sk-ant-`) | High |
| 암호화 자료 | `-----BEGIN ... PRIVATE KEY-----`, JWT, GCP service-account JSON | High / Medium |
| 일반 할당식 | `password = "..."`, `api_key: "..."` (12자 이상 혼합문자) | Medium |
| 민감 베이스네임 | `.env*`, `credentials.json`, `secrets.{yml,yaml}`, `firebase-adminsdk.json` | Medium |
| 개인정보 경로 (차단) | `**/.ssh/**`, `**/.aws/**`, `**/.gnupg/**`, `**/*.pem`, `**/*.key`, `**/.npmrc`, `**/.netrc`, 셸 히스토리, OS 키체인 | 카운트만 보고 — 내용은 절대 읽지 않음 |

전체 목록은 [`src/patterns.ts`](./src/patterns.ts) 참조.

## 설치

```bash
git clone https://github.com/cmblir/PathSentinel.git
cd PathSentinel
npm install
npm run build
```

Node.js **20 이상** 필요.

## 설정

`/absolute/path/to/PathSentinel`은 클론한 위치로 교체하세요.

### Claude Desktop

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

### Claude Code (CLI)

```bash
claude mcp add path-sentinel node /absolute/path/to/PathSentinel/dist/index.js
```

이후 다음과 같이 요청합니다:

> path-sentinel을 사용해서 현재 디렉터리의 비밀과 민감 파일을 스캔해줘.

## 도구: `scan_path`

**입력**

| 필드 | 타입 | 필수 | 설명 |
| :--- | :--- | :--- | :--- |
| `path` | string | 예 | 스캔할 프로젝트·디렉터리·단일 파일의 절대 또는 상대 경로 |
| `followSymlinks` | boolean | 아니오 | 심볼릭 링크 추적 여부. 기본값 false. |

**출력** — `target`, `findings`, `summary`로 구성된 JSON:

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

findings가 비었을 때는 `message` 필드가 추가되어 깨끗한 스캔과 빈 오류를
구분할 수 있습니다.

## 프로그래밍적 사용

스캐너는 라이브러리로도 export됩니다:

```ts
import { ProjectGuardian } from "path-sentinel";

const guardian = new ProjectGuardian({ followSymlinks: false });
const result = await guardian.scan("/path/to/project");
console.log(result.summary, result.findings);
```

## 한계

- **패턴 기반 탐지**. 엔트로피·AST 분석은 수행하지 않습니다. 인식 가능한
  prefix가 없고 generic 규칙의 12자 임계치 이하인 비밀은 빠질 수 있습니다.
- **줄당 첫 매치**. 동일 줄에 여러 비밀이 있으면 finding은 여러 번 보고되지만
  excerpt는 단일 매치 기준이므로 line 번호로 확인하세요.
- **1 MiB 초과 파일은 스킵**. 임베딩 시 `new ProjectGuardian({ maxFileBytes: ... })`로 조정 가능.
- **git 히스토리 스캔 없음**. 현재 working tree만 검사합니다.

## 개발

```bash
npm install
npm run dev      # tsx로 소스에서 실행
npm run build    # dist/ 산출
npm test         # node:test 러너
```

테스트는 `src/__tests__/`에 위치하며 OS temp 디렉터리에 합성 fixture를
만들어 동작합니다. 실제 비밀은 작성·읽지 않습니다.

## 트러블슈팅

| 증상 | 원인 | 조치 |
| :--- | :--- | :--- |
| `Cannot find module ".../dist/index.js"` | 빌드를 건너뜀 | `npm run build` 실행 |
| 비밀이 있는 레포인데 0 findings | 개인정보 경로·`node_modules/`가 기본 제외됨 | `summary.blockedByPrivacy`, `summary.skippedBinary` 확인 |
| `Path does not exist` | 경로 오타 또는 cwd 차이 | 절대 경로 전달 |
| stderr에 권한 오류 로그 | 현재 사용자가 읽을 수 없는 파일 | 적절한 권한으로 실행. PathSentinel은 해당 파일을 스킵하고 계속 진행 |

## 기여

이슈와 PR 환영합니다 — 특히 정밀도 높은 새 탐지 규칙과 false-positive 보정.

## 라이선스

ISC. [LICENSE](./LICENSE) 참조.
