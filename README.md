# 🛡️ PathSentinel

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

**PathSentinel** is a specialized Model Context Protocol (MCP) server that acts as a security gateway between your local environment and Large Language Models (LLMs). It prevents AI from reading sensitive files like `.env`, SSH keys, or hardcoded tokens, and identifies security risks in your project.

## ✨ Key Features

- **🔒 Privacy Guard**: Automatically blocks access to sensitive system paths (e.g., `.ssh`, `.aws`, `.history`).
- **🔍 Secret Radar**: Detects hardcoded secrets like AWS keys, GitHub tokens, and more.
- **🚫 Zero-Leak Policy**: High-risk files are reported but never read to ensure zero data leakage to the model.
- **⚡ Fast Scanning**: Efficient directory walking using glob patterns for real-time analysis.

## 🚀 Installation

```bash
git clone https://github.com/cmblir/PathSentinel.git
cd PathSentinel
npm install
npm run build
```

## ⚙️ Configuration

### Claude Desktop
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

### Claude Code (CLI)
To use PathSentinel with **Claude Code**, run the following command to add the MCP server:

```bash
claude mcp add path-sentinel node /Users/o/project-guardian/dist/index.js
```

Once added, you can ask Claude to scan your project:
> "Claude, scan the current directory for security risks using path-sentinel."

## 🛠️ Detection Suite

| Type | Description | Severity |
| :--- | :--- | :--- |
| **Secrets** | AWS Keys, GitHub Tokens, Generic API Keys | 🔴 High |
| **Config** | `.env`, `credentials.json`, `secrets.yml` | 🟡 Medium |
| **Privacy** | `.ssh`, `.gnupg`, `*history`, `.npmrc` | 🔒 Blocked |

## 🤝 Contributing
Contributions are welcome! Feel free to open an Issue or PR for new detection patterns.

## 📄 License
Distributed under the ISC License.
