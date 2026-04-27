# 🛡️ PathSentinel (패스센티널)

<p align="center">
  <pre>
     .--------.
    /          \
   |  🔍  🛡️  |  < "안전하게 스캔 중!"
    \  ____  /
    /      \
   |        |
   |   🍌   |  < Senti-Nana 가 지켜보고 있어요!
    \______/
  </pre>
</p>

<p align="center">
  <b>LLM 워크플로우를 위한 보이지 않는 방패.</b><br>
  <i>모델에 코드가 전달되기 전, 민감한 정보를 자동으로 탐지하고 개인정보 경로를 보호합니다.</i>
</p>

---

## 🤖 PathSentinel이란?

**PathSentinel**은 Claude와 같은 대규모 언어 모델(LLM)이 여러분의 로컬 코드를 분석할 때 보안 게이트웨이 역할을 하는 특화된 MCP(Model Context Protocol) 서버입니다.

AI가 코드베이스를 탐색할 때 실수로 `.env` 파일, SSH 키, 또는 하드코딩된 API 토큰을 읽는 위험이 있습니다. **PathSentinel**은 이러한 민감한 경로를 스캔 대상에서 물리적으로 차단하고, 프로젝트 내 숨겨진 보안 리스크를 즉시 알려줍니다.

## ✨ 핵심 기능

- **🛡️ Privacy Guard**: `.ssh`, `.aws`, `.history` 등 절대 스캔해서는 안 되는 경로 자동 차단.
- **🔍 Secret Radar**: AWS 키, GitHub 토큰 등을 탐지하는 고정밀 정규식 엔진 탑재.
- **🚫 Zero-Leak Policy**: 고위험 파일은 내용을 절대 읽지 않고 존재 여부만 보고하여 컨텍스트 노출 방지.
- **⚡ 초고속 스캔**: Glob 패턴과 병렬 디렉토리 탐색으로 실시간 결과 제공.

## 🚀 빠른 시작

### 1. 설치
```bash
git clone https://github.com/cmblir/PathSentinel.git
cd PathSentinel
npm install
npm run build
```

### 2. Claude Desktop 설정
`claude_desktop_config.json`에 아래 내용을 추가하세요:

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

## 🛠️ 탐지 항목

| 유형 | 설명 | 위험도 |
| :--- | :--- | :--- |
| **Secrets** | AWS 키, GitHub 토큰, 일반 API 키 | 🔴 높음 |
| **Config** | `.env`, `credentials.json`, `secrets.yml` | 🟡 중간 |
| **Privacy** | `.ssh`, `.gnupg`, `*history`, `.npmrc` | 🔒 차단됨 |

## 🤝 기여하기
새로운 비밀번호 패턴이나 더 나은 제외 규칙이 있다면 언제든 Issue나 PR을 남겨주세요!

## 📄 라이선스
ISC 라이선스를 따릅니다. 자세한 내용은 `LICENSE`를 참조하세요.
