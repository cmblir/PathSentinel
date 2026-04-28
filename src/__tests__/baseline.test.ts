// Unit tests for baseline / diff support.

import { test } from "node:test";
import * as assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";

import { applyBaseline, fingerprint, loadBaseline } from "../baseline.js";
import type { Finding, ScanResult } from "../types.js";

function makeFinding(over: Partial<Finding> = {}): Finding {
  return {
    severity: "high",
    type: "Hardcoded Secret",
    rule: "AWS Access Key",
    file: "/repo/src/legacy.js",
    line: 12,
    description: "Possible AWS Access Key detected (confidence: high).",
    excerpt: 'const KEY = "AKIA…[REDACTED]";',
    ...over,
  };
}

function makeResult(findings: Finding[]): ScanResult {
  return {
    target: "/repo",
    findings,
    summary: {
      scannedFiles: 1,
      skippedBinary: 0,
      skippedLarge: 0,
      blockedByPrivacy: 0,
      durationMs: 1,
    },
  };
}

test("fingerprint excludes excerpt so redaction width drift does not change identity", () => {
  const a = makeFinding({ excerpt: "AKIA…[REDACTED]" });
  const b = makeFinding({ excerpt: "different excerpt text" });
  assert.equal(fingerprint(a), fingerprint(b));
});

test("fingerprint differs when rule, file, line or type differ", () => {
  const base = makeFinding();
  assert.notEqual(fingerprint(base), fingerprint(makeFinding({ rule: "GitHub Token" })));
  assert.notEqual(fingerprint(base), fingerprint(makeFinding({ file: "/elsewhere.js" })));
  assert.notEqual(fingerprint(base), fingerprint(makeFinding({ line: 13 })));
  assert.notEqual(
    fingerprint(base),
    fingerprint(makeFinding({ type: "Sensitive File" })),
  );
});

test("applyBaseline removes only matching findings", () => {
  const stale = makeFinding({ rule: "AWS Access Key", line: 12 });
  const fresh = makeFinding({ rule: "AWS Access Key", line: 99 });
  const baseline = new Set<string>([fingerprint(stale)]);
  const result = makeResult([stale, fresh]);
  const filtered = applyBaseline(result, baseline);
  assert.equal(filtered.findings.length, 1);
  assert.equal(filtered.findings[0]!.line, 99);
});

test("loadBaseline reads a prior PathSentinel JSON report", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "ps-baseline-"));
  const file = path.join(dir, "baseline.json");
  await writeFile(file, JSON.stringify(makeResult([makeFinding()])), "utf-8");
  const set = await loadBaseline(file);
  assert.equal(set.size, 1);
  assert.ok(set.has(fingerprint(makeFinding())));
});

test("loadBaseline rejects malformed JSON", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "ps-baseline-"));
  const file = path.join(dir, "broken.json");
  await writeFile(file, "{not json", "utf-8");
  await assert.rejects(() => loadBaseline(file), /not valid JSON/);
});

test("loadBaseline rejects payload without findings array", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "ps-baseline-"));
  const file = path.join(dir, "wrong.json");
  await writeFile(file, JSON.stringify({ target: "/x" }), "utf-8");
  await assert.rejects(() => loadBaseline(file), /'findings' array/);
});

test("loadBaseline surfaces missing-file errors clearly", async () => {
  await assert.rejects(
    () => loadBaseline("/this/does/not/exist/__zzz__.json"),
    /Cannot read baseline file/,
  );
});
