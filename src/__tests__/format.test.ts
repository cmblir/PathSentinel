// Unit tests for the output formatters.

import { test } from "node:test";
import * as assert from "node:assert/strict";

import { formatResult } from "../format/index.js";
import { formatJson } from "../format/json.js";
import { formatSarif } from "../format/sarif.js";
import { formatText } from "../format/text.js";
import type { Finding, ScanResult } from "../types.js";

function makeResult(findings: Finding[] = []): ScanResult {
  return {
    target: "/repo",
    findings,
    summary: {
      scannedFiles: 10,
      skippedBinary: 1,
      skippedLarge: 0,
      blockedByPrivacy: 4,
      durationMs: 12,
    },
  };
}

const HIGH: Finding = {
  severity: "high",
  type: "Hardcoded Secret",
  rule: "AWS Access Key",
  file: "/repo/src/legacy.js",
  line: 12,
  description: "Possible AWS Access Key detected (confidence: high).",
  excerpt: 'const KEY = "AKIA…[REDACTED]";',
};

const MEDIUM: Finding = {
  severity: "medium",
  type: "Sensitive File",
  rule: "Sensitive Config",
  file: "/repo/.env",
  description: "Sensitive configuration file present: .env.",
};

// Use a Unicode escape () so the literal byte appears in the file
// without confusing source readers or regexes that scan for `\x1b`.
const ESC = "";

test("text formatter renders plain output without ANSI sequences when color=false", () => {
  const out = formatText(makeResult([HIGH]), { color: false, quiet: false });
  assert.ok(out.includes("[high]"));
  assert.ok(out.includes("AWS Access Key"));
  assert.ok(out.includes("legacy.js:12"));
  assert.ok(!out.includes(ESC), "no ANSI escapes should appear when color=false");
});

test("text formatter applies ANSI sequences when color=true", () => {
  const out = formatText(makeResult([HIGH]), { color: true, quiet: true });
  assert.ok(out.includes(ESC), "ANSI escape sequences expected when color=true");
});

test("text formatter filters by severity threshold", () => {
  const out = formatText(makeResult([HIGH, MEDIUM]), {
    color: false,
    quiet: true,
    severityFilter: "high",
  });
  assert.ok(out.includes("AWS Access Key"));
  assert.ok(!out.includes("Sensitive Config"));
});

test("text formatter reports 'No findings.' when result is empty", () => {
  const out = formatText(makeResult([]), { color: false, quiet: true });
  assert.ok(out.includes("No findings."));
});

test("json formatter returns parseable JSON with the same shape as MCP tool", () => {
  const out = formatJson(makeResult([HIGH]));
  const parsed = JSON.parse(out);
  assert.equal(parsed.findings.length, 1);
  assert.equal(parsed.findings[0].rule, "AWS Access Key");
  assert.equal(parsed.summary.scannedFiles, 10);
  assert.equal(parsed.message, undefined);
});

test("json formatter adds a 'message' field when there are no findings", () => {
  const parsed = JSON.parse(formatJson(makeResult([])));
  assert.match(parsed.message, /No security issues/);
});

test("sarif formatter produces SARIF 2.1.0 with rule + result objects", () => {
  const out = formatSarif(makeResult([HIGH, MEDIUM]));
  const doc = JSON.parse(out);
  assert.equal(doc.version, "2.1.0");
  assert.equal(doc.runs.length, 1);
  const driver = doc.runs[0].tool.driver;
  assert.equal(driver.name, "PathSentinel");
  assert.equal(driver.rules.length, 2);
  const ruleIds = driver.rules.map((r: { id: string }) => r.id).sort();
  assert.deepEqual(ruleIds, ["AWS Access Key", "Sensitive Config"]);
  const results = doc.runs[0].results;
  assert.equal(results.length, 2);
  assert.equal(results[0].ruleId, "AWS Access Key");
  assert.equal(results[0].level, "error");
  assert.equal(results[0].locations[0].physicalLocation.region.startLine, 12);
  assert.equal(results[1].level, "warning");
  // Sensitive File finding has no `line` so SARIF entry must omit `region`.
  assert.equal(results[1].locations[0].physicalLocation.region, undefined);
});

test("sarif formatter encodes file paths as file:// URIs", () => {
  const out = formatSarif(makeResult([HIGH]));
  const doc = JSON.parse(out);
  const uri = doc.runs[0].results[0].locations[0].physicalLocation.artifactLocation.uri;
  assert.match(uri, /^file:\/\//);
});

test("formatResult dispatches to the requested formatter", () => {
  const r = makeResult([HIGH]);
  assert.ok(formatResult(r, "json", { color: false, quiet: true }).startsWith("{"));
  assert.ok(formatResult(r, "sarif", { color: false, quiet: true }).includes("sarif"));
  assert.ok(formatResult(r, "text", { color: false, quiet: true }).includes("[high]"));
});
