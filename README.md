# 🛡️ PathSentinel

<p align="center">
  <img src="https://raw.githubusercontent.com/cmblir/PathSentinel/main/assets/logo.png" width="200" alt="PathSentinel Logo">
</p>

<p align="center">
  <b>The Invisible Shield for your LLM Workflows.</b><br>
  <i>Automatically detect secrets and protect private paths before they reach the model.</i>
</p>

<p align="center">
  <a href="https://modelcontextprotocol.io"><img src="https://img.shields.io/badge/MCP-Supported-blue.svg" alt="MCP"></a>
  <a href="https://opensource.org/licenses/ISC"><img src="https://img.shields.io/badge/License-ISC-green.svg" alt="License"></a>
  <a href="https://github.com/cmblir/PathSentinel/stargazers"><img src="https://img.shields.io/github/stars/cmblir/PathSentinel?style=flat-square" alt="Stars"></a>
  <a href="https://github.com/cmblir/PathSentinel/issues"><img src="https://img.shields.io/github/issues/cmblir/PathSentinel?style=flat-square" alt="Issues"></a>
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

## 🎨 Mascot: The Sentinel
```text
      / \
     |   |      [ SCANNING... ]
     |   |    /
   _/[---]\_
  |         |
  |  (O) (O) |  <- Cyber-Lens eyes
  |    ___   |
   \_______/
     /   \
    /     \
```

## 🤝 Contributing

We love contributions! Whether it's a new secret pattern or a better exclusion rule, feel free to open an Issue or PR. 

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License
Distributed under the ISC License. See `LICENSE` for more information.

---
<p align="center">Made with ❤️ for the AI community</p>
