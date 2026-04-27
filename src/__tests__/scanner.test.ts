// Unit tests for ProjectGuardian.
// Uses Node's built-in test runner; no Jest/Vitest dependency required.
//
// All fixture data is synthetic. AWS example keys come from public AWS docs.

import { test } from "node:test";
import * as assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { ProjectGuardian } from "../scanner.js";

async function makeFixture(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), "path-sentinel-"));

  // Plain source file with a secret keyword but a value too short to trigger
  // the tightened Generic Secret Assignment rule.
  await writeFile(
    path.join(root, "config.ts"),
    'export const password = "short";\n',
    "utf-8",
  );

  // Public AWS docs example key (not a real active key).
  await writeFile(
    path.join(root, "leak.js"),
    'const KEY = "AKIAIOSFODNN7EXAMPLE";\n',
    "utf-8",
  );

  // Synthetic GitHub server-to-server token.
  // Verifies the fix for the original `[p|o|u|s]` regex bug — `ghs_`
  // must now match.
  await writeFile(
    path.join(root, "ghs.txt"),
    "token=ghs_" + "a".repeat(36) + "\n",
    "utf-8",
  );

  // .env basename is sensitive; the test asserts content is never surfaced.
  await writeFile(
    path.join(root, ".env"),
    "DB_PASSWORD=hunter2\n",
    "utf-8",
  );

  // Privacy-denied path: an .ssh folder with an id_rsa file (synthetic).
  await mkdir(path.join(root, ".ssh"), { recursive: true });
  await writeFile(
    path.join(root, ".ssh", "id_rsa"),
    "-----BEGIN OPENSSH PRIVATE KEY-----\nfake\n-----END OPENSSH PRIVATE KEY-----\n",
    "utf-8",
  );

  // Binary-extension file with secret-looking bytes; should be skipped.
  await writeFile(
    path.join(root, "logo.png"),
    "AKIAIOSFODNN7EXAMPLE",
    "utf-8",
  );

  return root;
}

test("detects AWS access keys with high severity", async () => {
  const root = await makeFixture();
  const result = await new ProjectGuardian().scan(root);
  const aws = result.findings.find((f) => f.rule === "AWS Access Key");
  assert.ok(aws, "expected AWS Access Key finding");
  assert.equal(aws!.severity, "high");
  assert.match(aws!.file, /leak\.js$/);
  assert.ok(aws!.excerpt && aws!.excerpt.includes("[REDACTED]"));
});

test("detects all GitHub token prefixes including ghs_", async () => {
  const root = await makeFixture();
  const result = await new ProjectGuardian().scan(root);
  const gh = result.findings.find((f) => f.rule === "GitHub Token");
  assert.ok(gh, "expected GitHub Token finding for ghs_ prefix");
});

test("reports .env as sensitive without reading content", async () => {
  const root = await makeFixture();
  const result = await new ProjectGuardian().scan(root);
  const env = result.findings.find(
    (f) => f.type === "Sensitive File" && f.file.endsWith(".env"),
  );
  assert.ok(env, "expected sensitive-file finding for .env");
  // Content must not appear in the description or any excerpt.
  for (const f of result.findings) {
    assert.ok(
      !(f.excerpt ?? "").includes("hunter2"),
      "scanner must not leak .env contents",
    );
    assert.ok(
      !f.description.includes("hunter2"),
      "scanner must not leak .env contents in description",
    );
  }
});

test("never reads files inside privacy-denied paths", async () => {
  const root = await makeFixture();
  const result = await new ProjectGuardian().scan(root);
  const sshLeak = result.findings.find((f) => f.file.includes("/.ssh/"));
  assert.equal(sshLeak, undefined, ".ssh contents must never be inspected");
  assert.ok(
    result.summary.blockedByPrivacy >= 1,
    "summary should count blocked privacy entries",
  );
});

test("skips known binary extensions", async () => {
  const root = await makeFixture();
  const result = await new ProjectGuardian().scan(root);
  assert.ok(
    result.summary.skippedBinary >= 1,
    "summary should report at least one binary skip (logo.png)",
  );
  const pngFinding = result.findings.find((f) => f.file.endsWith("logo.png"));
  assert.equal(
    pngFinding,
    undefined,
    "binary file must not produce content findings",
  );
});

test("does not flag short quoted values as generic secrets", async () => {
  const root = await makeFixture();
  const result = await new ProjectGuardian().scan(root);
  const fp = result.findings.find(
    (f) =>
      f.rule === "Generic Secret Assignment" && f.file.endsWith("config.ts"),
  );
  assert.equal(
    fp,
    undefined,
    'short values like "short" must not match the tightened generic rule',
  );
});

test("throws clear error on missing path", async () => {
  await assert.rejects(
    () => new ProjectGuardian().scan("/this/path/does/not/exist/__zzz__"),
    /Path does not exist/,
  );
});
