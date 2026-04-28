<h1 align="center">PathSentinel</h1>

<p align="center">
  <b>LLM 시대를 위한 프라이버시 우선 시크릿 스캐너.</b><br/>
  하드코딩된 비밀, 민감 설정 파일, 개인 자격증명 경로가
  거대 언어 모델(LLM)에 도달하는 것을 사전에 차단합니다.
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
- [사용법](#사용법)
- [탐지 규칙](#탐지-규칙)
- [출력 스키마](#출력-스키마)
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
디렉터리 워크** 자체를 보호합니다. 바이트가 프롬프트에 진입하기 전에
차단하는 것이 일입니다.

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
- **Excerpt는 redact됩니다.** 비밀 패턴이 매치되면 처음 4자만 노출하고
  나머지는 `…[REDACTED]`로 치환됩니다. 전체 비밀이 스캐너를 떠나는 일은
  없습니다.
- **안정적이고 구조화된 출력.** severity / rule 라벨이 안정적이라 grader,
  CI, 다운스트림 도구가 결과에 단언(assert)을 걸 수 있습니다.
- **부수효과 없음.** 네트워크 호출, 텔레메트리, 설정 파일 쓰기, 캐시
  생성이 일체 없습니다. 순수 read-only 검사.
- **MCP 호환.** Claude Desktop, Claude Code, 기타 모든 Model Context
  Protocol 클라이언트에 드롭인으로 사용 가능.

## Quick Start

```bash
git clone https://github.com/cmblir/PathSentinel.git
cd PathSentinel
npm install && npm run build
```

Claude Code에 등록:

```bash
claude mcp add path-sentinel node "$(pwd)/dist/index.js"
```

모델에 요청:

> path-sentinel으로 현재 디렉터리를 스캔해서, 이 레포를 공유하기 전에
> 새어 나갈 만한 게 있는지 알려줘.

## 설치

### 사전 요구사항

- Node.js **20 이상**
- npm (또는 호환 패키지 매니저)

### 소스에서 빌드

```bash
git clone https://github.com/cmblir/PathSentinel.git
cd PathSentinel
npm install
npm run build
```

### 클라이언트에 연결

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

#### 기타 MCP 클라이언트

stdio 기반 MCP를 말하는 모든 클라이언트가 동작합니다.
`node /absolute/path/to/PathSentinel/dist/index.js`를 가리키도록 설정하면
`scan_path` 도구가 노출됩니다.

## 사용법

### MCP 도구로

서버는 단일 도구를 제공합니다:

| 도구 | 설명 |
| :--- | :--- |
| `scan_path` | 프로젝트 경로에서 하드코딩 시크릿, 민감 설정 파일, 프라이버시 차단 경로를 스캔합니다. |

**입력 파라미터**

| 필드 | 타입 | 필수 | 기본값 | 설명 |
| :--- | :--- | :--- | :--- | :--- |
| `path` | string | 예 | — | 스캔할 프로젝트·디렉터리·단일 파일의 절대 또는 상대 경로. |
| `followSymlinks` | boolean | 아니오 | `false` | 심볼릭 링크 추적 여부. 루프와 의도치 않은 트리 진입을 막기 위해 기본값 false. |

### 프로그래밍 사용

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

### 사용 예시

```
> path-sentinel으로 ./demo를 스캔해줘

3개 이슈 발견:
  [high]   AWS Access Key       demo/src/legacy.js:12
  [medium] Sensitive Config     demo/.env
  [medium] OpenAI API Key       demo/scripts/oneoff.ts:4

요약: 142개 파일 스캔, 17개 바이너리 스킵, 38개 경로가 프라이버시 규칙으로 차단됨 (184 ms)
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

## 출력 스키마

성공한 모든 스캔은 동일한 JSON 형태를 반환합니다:

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

## 다른 스캐너와의 비교

| | PathSentinel | gitleaks | trufflehog | detect-secrets |
| :--- | :---: | :---: | :---: | :---: |
| LLM / MCP 컨텍스트 전용 설계 | yes | no | no | no |
| `~/.ssh`, `~/.aws` 읽기 차단 | yes | no | no | no |
| `.env`를 내용 노출 없이 보고 | yes | partial | partial | partial |
| 출력 전 excerpt redact | yes | no | no | partial |
| Git 히스토리 스캔 | no | yes | yes | no |
| 자격증명 라이브 검증 | no | no | yes | no |
| 엔트로피 / AST 분석 | no | yes | yes | yes |
| 런타임 | Node ≥20 | Go binary | Go binary | Python |

PathSentinel과 gitleaks/trufflehog은 보완재입니다. CI에서 커밋 그래프
검사는 gitleaks/trufflehog로, 로컬 파일시스템과 AI 에이전트 사이의 게이트는
PathSentinel로 사용하세요.

## FAQ

**Q. git 히스토리도 스캔하나요?**
아니요. PathSentinel은 현재 working tree만 검사합니다. 히스토리 스캔은
gitleaks 또는 trufflehog을 사용하세요.

**Q. 엔트로피 탐지가 없는 이유는?**
엔트로피는 알려지지 않은 형식의 시크릿을 잡는 데 좋지만 false positive가
많습니다. 출력이 LLM에 의해 읽힐 때 정확히 피해야 할 특성입니다.
PathSentinel은 의도적으로 정밀도 높은(high-precision) 규칙에 집중합니다.

**Q. `node_modules/`가 제외되는 이유는?**
성능과 노이즈 때문입니다. `node_modules/` 내부 자격증명 누출의 대부분은
실제 시크릿이 아니라 패키지에 포함된 테스트 fixture입니다. 의존성도
검사하려면 `extraIgnore: []`로 오버라이드하세요.

**Q. 에이전트가 느려지진 않나요?**
일반적인 50,000개 파일 레포가 최신 노트북에서 1초 미만으로 스캔됩니다.
1 MiB 초과 파일과 바이너리 확장자는 기본적으로 스킵됩니다.

**Q. MCP 외에서도 사용할 수 있나요?**
`ProjectGuardian` 클래스는 MCP 의존성 없이 export되어 있어 오늘 당장 어떤
Node 스크립트에서도 사용 가능합니다. Standalone CLI / GitHub Action /
pre-commit 통합은 로드맵에 있습니다.

**Q. `$HOME`에 실행해도 안전한가요?**
예 — 그것이 명시적 설계 목표입니다. 프라이버시 경로는 어떤 바이트도
읽기 전에 필터링됩니다. summary의 0이 아닌 `blockedByPrivacy` 카운트가
그 증거입니다.

## 한계

- **패턴 기반 탐지**. 엔트로피·AST 분석은 수행하지 않습니다. 인식 가능한
  prefix가 없고 generic 규칙의 12자 임계치 이하인 비밀은 빠질 수 있습니다.
- **줄당 첫 매치**. 동일 줄의 여러 비밀은 별도 finding으로 surface될 수
  있지만 excerpt는 단일 매치 기준이므로 line 번호로 확인하세요.
- **1 MiB 초과 파일은 스킵**. 임베딩 시
  `new ProjectGuardian({ maxFileBytes: ... })`로 조정 가능.
- **Working tree 전용**. git 히스토리, 원격, 바이너리 산출물은 검사하지
  않습니다.
- **stdio 전송만 지원** (현재). Streamable HTTP transport는 로드맵에 있습니다.

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
src/
├── index.ts      # CLI 부트스트랩 + public API 재노출
├── server.ts     # MCP wiring (stdio transport, tool registration)
├── scanner.ts    # ProjectGuardian — 순회 + 콘텐츠 매칭
├── patterns.ts   # 탐지 규칙 (privacy / sensitive / secrets)
├── types.ts      # 도메인 타입
└── __tests__/    # node:test 스위트
```

## 기여

이슈와 PR 환영합니다 — 특히:

- 정밀도 높은 새 탐지 규칙 (샘플 라인과 공식 포맷 스펙 인용을 첨부해
  주세요).
- false positive 보고 (재현 케이스 포함).
- 추가 어댑터 (CLI 서브커맨드, GitHub Action, Docker 이미지, SARIF 출력 —
  [프로젝트 issues](https://github.com/cmblir/PathSentinel/issues) 참조).

PR을 열기 전에 `npm test`와 `npm run build`를 실행하세요.

## 라이선스

[ISC](./LICENSE).
