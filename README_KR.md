# 🛡️ PathSentinel (패스센티널)

<p align="center">
  <b>LLM 워크플로우를 위한 보이지 않는 방패.</b><br>
  <i>모델에 코드가 전달되기 전, 민감한 정보를 자동으로 탐지하고 개인정보 경로를 보호합니다.</i>
</p>

<p align="center">
  <a href="https://modelcontextprotocol.io"><img src="https://img.shields.io/badge/MCP-Supported-blue.svg" alt="MCP"></a>
  <a href="https://opensource.org/licenses/ISC"><img src="https://img.shields.io/badge/License-ISC-green.svg" alt="License"></a>
</p>

---

## 🤖 PathSentinel이란?

**PathSentinel**은 Claude와 같은 대규모 언어 모델(LLM)이 여러분의 로컬 코드를 분석할 때 보안 게이트웨이 역할을 하는 특화된 MCP(Model Context Protocol) 서버입니다. AI가 코드베이스를 탐색할 때 실수로 `.env` 파일, SSH 키, 또는 API 토큰을 읽는 위험을 방지하고 프로젝트 내 보안 리스크를 탐지합니다.

## ✨ 핵심 기능

- **🔒 Privacy Guard**: `.ssh`, `.aws`, `.history` 등 민감한 시스템 경로에 대한 접근을 자동으로 차단합니다.
- **🔍 Secret Radar**: AWS 키, GitHub 토큰 등 하드코딩된 비밀번호를 정교하게 찾아냅니다.
- **🚫 Zero-Leak Policy**: 고위험 파일은 내용물 대신 존재 여부만 보고하여 모델로의 정보 유출을 차단합니다.
- **⚡ Fast Scanning**: Glob 패턴과 효율적인 탐색으로 실시간 보안 분석을 제공합니다.

## 🚀 설치 방법

```bash
git clone https://github.com/cmblir/PathSentinel.git
cd PathSentinel
npm install
npm run build
```

## ⚙️ 설정 방법

### Claude Desktop
`claude_desktop_config.json` 파일에 아래 설정을 추가하세요:

```json
{
  "mcpServers": {
    "path-sentinel": {
      "command": "node",
      "args": ["/Users/o/project-guardian/dist/index.js"]
    }
  }
}
```

### Claude Code (CLI)
**Claude Code**에서 PathSentinel을 사용하려면 다음 명령어를 실행하여 MCP 서버를 등록하세요:

```bash
claude mcp add path-sentinel node /Users/o/project-guardian/dist/index.js
```

등록 후에는 다음과 같이 요청할 수 있습니다:
> "Claude, path-sentinel을 사용해서 현재 디렉토리의 보안 위험을 스캔해줘."

## 🛠️ 탐지 항목

| 유형 | 설명 | 위험도 |
| :--- | :--- | :--- |
| **Secrets** | AWS 키, GitHub 토큰, 일반 API 키 | 🔴 높음 |
| **Config** | `.env`, `credentials.json`, `secrets.yml` | 🟡 중간 |
| **Privacy** | `.ssh`, `.gnupg`, `*history`, `.npmrc` | 🔒 차단됨 |

## 📄 라이선스
ISC License.
