// Detection patterns for PathSentinel.
//
// Three categories:
//   1. PRIVACY_DENY_LIST — globs that are excluded from any traversal so
//      their content is never read into memory or transmitted to the model.
//   2. SENSITIVE_FILES   — file basenames reported as risky configs
//      (existence is reported but content is NOT exposed).
//   3. SECRET_PATTERNS   — content regex rules with a stable label.

export const PRIVACY_DENY_LIST: readonly string[] = [
  // SSH / GPG / TLS material
  "**/.ssh/**",
  "**/.gnupg/**",
  "**/*.pem",
  "**/*.key",
  "**/*.pfx",
  "**/*.p12",
  "**/id_rsa",
  "**/id_ed25519",
  // Shell history / rc files
  "**/.*history",
  "**/.zshrc",
  "**/.bash_profile",
  "**/.bashrc",
  "**/.npmrc",
  "**/.netrc",
  // Cloud credential stores
  "**/.aws/**",
  "**/.gcloud/**",
  "**/.azure/**",
  "**/.kube/config",
  "**/.docker/config.json",
  // OS profile data
  "**/Library/Application Support/**",
  "**/Library/Keychains/**",
  // VCS internals (noisy and may include hooks/credentials)
  "**/.git/**",
  // Build artefacts and dependency caches (performance + noise)
  "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/.next/**",
  "**/.turbo/**",
  "**/coverage/**",
  "**/__pycache__/**",
  "**/venv/**",
  "**/.venv/**",
];

export const SENSITIVE_FILES: readonly string[] = [
  ".env",
  ".env.local",
  ".env.development",
  ".env.production",
  ".env.staging",
  "credentials.json",
  "credentials",
  "secrets.yml",
  "secrets.yaml",
  "service-account.json",
  "firebase-adminsdk.json",
];

export interface SecretRule {
  /** Stable label, used in Finding.rule. */
  label: string;
  /** Pattern matched against each line. */
  pattern: RegExp;
  /** Rough confidence: high = unique prefix, low = generic keyword match. */
  confidence: "high" | "medium" | "low";
}

// Patterns are intentionally not anchored with ^/$ so they can match
// inline assignments inside source code.
export const SECRET_PATTERNS: readonly SecretRule[] = [
  {
    label: "AWS Access Key",
    pattern: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/,
    confidence: "high",
  },
  {
    label: "AWS Secret Key",
    pattern:
      /(aws_secret_access_key|AWS_SECRET_ACCESS_KEY)["'\s:=]+["']?[A-Za-z0-9/+=]{40}["']?/,
    confidence: "high",
  },
  {
    label: "GitHub Token",
    // ghp_ (PAT), gho_ (OAuth), ghu_ (user-to-server),
    // ghs_ (server-to-server), ghr_ (refresh)
    pattern: /\bgh[pousr]_[A-Za-z0-9]{36,255}\b/,
    confidence: "high",
  },
  {
    label: "GitHub Fine-Grained PAT",
    pattern: /\bgithub_pat_[A-Za-z0-9_]{82}\b/,
    confidence: "high",
  },
  {
    label: "Slack Token",
    pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/,
    confidence: "high",
  },
  {
    label: "Stripe Secret Key",
    pattern: /\b(sk|rk)_(live|test)_[A-Za-z0-9]{16,}\b/,
    confidence: "high",
  },
  {
    label: "Google API Key",
    pattern: /\bAIza[0-9A-Za-z_\-]{35}\b/,
    confidence: "high",
  },
  {
    label: "GCP Service Account JSON",
    pattern: /"type"\s*:\s*"service_account"/,
    confidence: "medium",
  },
  {
    label: "OpenAI API Key",
    pattern: /\bsk-(?:proj-)?[A-Za-z0-9_\-]{20,}\b/,
    confidence: "medium",
  },
  {
    label: "Anthropic API Key",
    pattern: /\bsk-ant-[A-Za-z0-9_\-]{20,}\b/,
    confidence: "high",
  },
  {
    label: "JWT",
    pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
    confidence: "medium",
  },
  {
    label: "Private Key Block",
    pattern: /-----BEGIN ((RSA|EC|DSA|OPENSSH|PGP) )?PRIVATE KEY-----/,
    confidence: "high",
  },
  {
    label: "Generic Secret Assignment",
    // Tightened: requires an explicit secret-like keyword AND a quoted value
    // of >= 12 chars mixing alphanumerics to avoid trivial false positives
    // such as `password: "localhost"`.
    pattern:
      /(password|passwd|secret|token|api[_-]?key|access[_-]?key)\s*[:=]\s*["'][A-Za-z0-9_+/=\-]{12,}["']/i,
    confidence: "low",
  },
];

/** Files we never inspect content of, even if reachable. */
export const BINARY_EXTENSIONS: readonly string[] = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".bmp",
  ".tiff",
  ".pdf",
  ".zip",
  ".tar",
  ".gz",
  ".bz2",
  ".7z",
  ".rar",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
  ".mp3",
  ".mp4",
  ".mov",
  ".avi",
  ".webm",
  ".so",
  ".dll",
  ".dylib",
  ".class",
  ".jar",
  ".node",
  ".wasm",
  ".bin",
];
