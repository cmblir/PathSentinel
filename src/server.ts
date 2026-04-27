// MCP server wiring for PathSentinel.
//
// Exposes a single tool, `scan_path`, over stdio. The tool result is JSON
// containing `findings` and a `summary` block; severities and rule labels
// are stable so downstream graders/tests can assert on them.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { ProjectGuardian } from "./scanner.js";

const SERVER_NAME = "path-sentinel";
const SERVER_VERSION = "1.1.0";

const ScanPathSchema = z.object({
  path: z
    .string()
    .min(1)
    .describe("Absolute or relative path to a project, directory, or single file to scan."),
  followSymlinks: z
    .boolean()
    .optional()
    .describe("Follow symlinks during traversal. Off by default."),
});

export function createServer(): Server {
  const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "scan_path",
        description:
          "Scan a project path for hardcoded secrets, sensitive config files, and privacy-restricted paths. " +
          "Privacy-restricted paths are reported as blocked and never read.",
        inputSchema: z.toJSONSchema(ScanPathSchema) as Record<string, unknown>,
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== "scan_path") {
      throw new McpError(
        ErrorCode.MethodNotFound,
        `Unknown tool: ${request.params.name}`,
      );
    }

    const parsed = ScanPathSchema.safeParse(request.params.arguments);
    if (!parsed.success) {
      throw new McpError(
        ErrorCode.InvalidParams,
        `Invalid arguments: ${parsed.error.message}`,
      );
    }
    const { path: targetPath, followSymlinks } = parsed.data;

    const guardian = new ProjectGuardian({ followSymlinks });

    try {
      const result = await guardian.scan(targetPath);
      const payload =
        result.findings.length > 0
          ? result
          : {
              ...result,
              message:
                "No security issues found. Privacy-restricted paths were skipped (see summary.blockedByPrivacy).",
            };
      return {
        content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: "text", text: `Error during scan: ${message}` }],
        isError: true,
      };
    }
  });

  return server;
}

export async function startStdio(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stderr only — stdout is owned by the MCP framing.
  console.error(`[${SERVER_NAME}] v${SERVER_VERSION} listening on stdio`);
}
