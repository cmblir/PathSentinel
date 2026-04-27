#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { z } from "zod";
import fs from "fs-extra";
import * as path from "path";
import { glob } from "glob";
import { fileURLToPath } from "url";

// --- Types ---

interface Finding {
  severity: "high" | "medium" | "low";
  type: string;
  file: string;
  description: string;
  line?: number;
}

// --- Constants ---

const PRIVACY_DENY_LIST = [
  "**/.ssh/**",
  "**/.gnupg/**",
  "**/*.pem",
  "**/*.key",
  "**/.*history",
  "**/.aws/**",
  "**/.gcloud/**",
  "**/Library/Application Support/**",
  "**/.zshrc",
  "**/.bash_profile",
  "**/.bashrc",
  "**/.npmrc",
  "**/.git/**",
];

const SECRET_PATTERNS: Record<string, RegExp> = {
  "AWS Access Key": /AKIA[0-9A-Z]{16}/,
  "AWS Secret Key": /("AWS_SECRET_ACCESS_KEY"|"aws_secret_access_key").*[:=].*["'][0-9a-zA-Z/+]{40}["']/,
  "GitHub Token": /gh[p|o|u|s]_[a-zA-Z0-9]{36}/,
  "Generic Secret": /(password|passwd|secret|token|api_key|apikey)[:=]\s*["'][^"']{8,}["']/i,
};

const SENSITIVE_FILES = [
  ".env",
  ".env.local",
  ".env.development",
  "config.json", // Often contains secrets
  "credentials.json",
  "secrets.yml",
];

// --- Scanner Logic ---

export class ProjectGuardian {
  async scan(targetPath: string): Promise<Finding[]> {
    const findings: Finding[] = [];
    const absolutePath = path.resolve(targetPath);

    if (!(await fs.pathExists(absolutePath))) {
      throw new McpError(ErrorCode.InvalidParams, `Path does not exist: ${targetPath}`);
    }

    const stats = await fs.stat(absolutePath);
    if (!stats.isDirectory()) {
      // If it's a file, just scan that file
      await this.scanFile(absolutePath, findings);
      return findings;
    }

    // Recursively find files, excluding deny-listed items
    const files = await glob("**/*", {
      cwd: absolutePath,
      ignore: PRIVACY_DENY_LIST,
      nodir: true,
      absolute: true,
      dot: true,
    });

    for (const file of files) {
      await this.scanFile(file, findings);
      this.checkSensitiveFile(file, findings);
    }

    return findings;
  }

  private async scanFile(filePath: string, findings: Finding[]) {
    try {
      // Don't read very large files
      const stats = await fs.stat(filePath);
      if (stats.size > 1024 * 1024) return; // Skip files > 1MB

      const content = await fs.readFile(filePath, "utf-8");
      const lines = content.split("\n");

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue; // Skip empty/undefined lines

        for (const [name, pattern] of Object.entries(SECRET_PATTERNS)) {
          if (pattern.test(line)) {
            findings.push({
              severity: "high",
              type: "Hardcoded Secret",
              file: filePath,
              description: `Possible ${name} detected.`,
              line: i + 1,
            });
          }
        }
      }
    } catch (err) {
      // Ignore read errors (e.g., binary files)
    }
  }

  private checkSensitiveFile(filePath: string, findings: Finding[]) {
    const fileName = path.basename(filePath);
    if (SENSITIVE_FILES.includes(fileName)) {
      findings.push({
        severity: "medium",
        type: "Sensitive File",
        file: filePath,
        description: `Potential sensitive configuration file detected: ${fileName}`,
      });
    }
  }
}

// --- MCP Server Implementation ---

const server = new Server(
  {
    name: "path-sentinel",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const ScanPathSchema = z.object({
  path: z.string().describe("The path to the project or directory to scan"),
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "scan_path",
      description: "Scans a project path for security vulnerabilities and secrets.",
      inputSchema: zodToJsonSchema(ScanPathSchema as any) as any,
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "scan_path") {
    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
  }

  const { path: targetPath } = ScanPathSchema.parse(request.params.arguments);
  const guardian = new ProjectGuardian();

  try {
    const findings = await guardian.scan(targetPath);
    return {
      content: [
        {
          type: "text",
          text: findings.length > 0 
            ? JSON.stringify(findings, null, 2)
            : "No security issues found. (Note: System sensitive paths were automatically skipped)",
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: "text",
          text: `Error during scan: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Project Guardian MCP server running on stdio");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
}
