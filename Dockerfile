# syntax=docker/dockerfile:1
#
# PathSentinel — multi-stage Dockerfile.
#
# Build:
#   docker build -t path-sentinel .
#
# Scan a directory (read-only mount):
#   docker run --rm -v "$PWD:/scan:ro" path-sentinel /scan
#
# Emit SARIF for GitHub Code Scanning:
#   docker run --rm -v "$PWD:/scan:ro" path-sentinel /scan --format sarif
#
# Run as MCP server over stdio (for orchestrators that can pipe):
#   docker run --rm -i path-sentinel mcp

# ---------- builder ---------------------------------------------------------
FROM node:20-alpine AS builder
WORKDIR /app

# Install full deps so we can run `tsc`.
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# ---------- runtime ---------------------------------------------------------
FROM node:20-alpine
LABEL org.opencontainers.image.title="PathSentinel" \
      org.opencontainers.image.description="Privacy-first secret scanner for the LLM era" \
      org.opencontainers.image.source="https://github.com/cmblir/PathSentinel" \
      org.opencontainers.image.licenses="ISC"

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json README.md LICENSE ./

# Run as a non-root user. The container only ever needs read access to
# whatever the caller mounts at /scan.
RUN addgroup -S sentinel && adduser -S sentinel -G sentinel
USER sentinel

ENTRYPOINT ["node", "/app/dist/index.js"]
CMD ["scan", "/scan"]
