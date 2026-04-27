# 🛡️ PathSentinel

<p align="center">
  <pre>
     .--------.
    /          \
   |  🔍  🛡️  |  < "Scanning Safely!"
    \  ____  /
    /      \
   |        |
   |   🍌   |  < Senti-Nana is watching!
    \______/
  </pre>
</p>

<p align="center">
  <b>The Invisible Shield for your LLM Workflows.</b><br>
  <i>Automatically detect secrets and protect private paths before they reach the model.</i>
</p>

<p align="center">
  <a href="https://modelcontextprotocol.io"><img src="https://img.shields.io/badge/MCP-Supported-blue.svg" alt="MCP"></a>
  <a href="https://opensource.org/licenses/ISC"><img src="https://img.shields.io/badge/License-ISC-green.svg" alt="License"></a>
  <a href="./README_KR.md"><img src="https://img.shields.io/badge/Docs-%ED%95%9C%EA%B5%AD%EC%96%B4-red.svg" alt="KO Docs"></a>
</p>

---

## 🤖 What is PathSentinel?

**PathSentinel** is a specialized Model Context Protocol (MCP) server designed to act as a security gateway between your local environment and Large Language Models (LLMs) like Claude. 

When you allow an AI to explore your codebase, there's a risk of it accidentally reading `.env` files, SSH keys, or hardcoded API tokens. **PathSentinel** ensures that these sensitive paths are physically blocked from the scanner and alerts you to any hidden security risks in your project.

## ✨ Key Features

- **🛡️ Privacy Guard**: Hardcoded list of "Never-Scan" paths (e.g., `.ssh`, `.aws`, `.history`).
- **🔍 Secret Radar**: High-precision regex engine to detect AWS keys, GitHub tokens, and more.
- **🚫 Zero-Leak Policy**: High-risk files are never read; their existence is only reported to keep your context safe.
- **⚡ Built for Speed**: Parallel directory walking with glob patterns for near-instant results.

## 🚀 Quick Start

### 1. Install
```bash
git clone https://github.com/cmblir/PathSentinel.git
cd PathSentinel
npm install
npm run build
```

### 2. Configure Claude Desktop
Add this to your `claude_desktop_config.json`:

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

## 🛠️ Detection Suite

| Type | Description | Severity |
| :--- | :--- | :--- |
| **Secrets** | AWS Keys, GitHub Tokens, Generic API Keys | 🔴 High |
| **Config** | `.env`, `credentials.json`, `secrets.yml` | 🟡 Medium |
| **Privacy** | `.ssh`, `.gnupg`, `*history`, `.npmrc` | 🔒 Blocked |

## 🤝 Contributing

We love contributions! Whether it's a new secret pattern or a better exclusion rule, feel free to open an Issue or PR. 

## 📄 License
Distributed under the ISC License. See `LICENSE` for more information.

---
<p align="center">Made with ❤️ for the AI community</p>
