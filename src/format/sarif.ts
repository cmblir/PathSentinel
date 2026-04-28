// SARIF 2.1.0 formatter.
//
// SARIF is the output format consumed by GitHub Code Scanning, GitLab
// SAST dashboards, and most enterprise SAST aggregators. Spec:
//   https://docs.oasis-open.org/sarif/sarif/v2.1.0/sarif-v2.1.0.html
//
// Mapping:
//   PathSentinel severity → SARIF level
//     high   → error
//     medium → warning
//     low    → note

import { pathToFileURL } from "node:url";

import type { Finding, ScanResult, Severity } from "../types.js";
import { VERSION } from "../version.js";

const SEVERITY_TO_LEVEL: Record<Severity, "error" | "warning" | "note"> = {
  high: "error",
  medium: "warning",
  low: "note",
};

interface SarifReportingDescriptor {
  id: string;
  name: string;
  shortDescription: { text: string };
  defaultConfiguration: { level: "error" | "warning" | "note" };
}

interface SarifResult {
  ruleId: string;
  level: "error" | "warning" | "note";
  message: { text: string };
  locations: Array<{
    physicalLocation: {
      artifactLocation: { uri: string };
      region?: { startLine: number };
    };
  }>;
}

export function formatSarif(result: ScanResult): string {
  const rules = collectRules(result.findings);
  const sarifResults = result.findings.map(toSarifResult);

  const doc = {
    $schema:
      "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "PathSentinel",
            version: VERSION,
            informationUri: "https://github.com/cmblir/PathSentinel",
            rules,
          },
        },
        results: sarifResults,
      },
    ],
  };

  return JSON.stringify(doc, null, 2);
}

function collectRules(findings: Finding[]): SarifReportingDescriptor[] {
  const seen = new Map<string, SarifReportingDescriptor>();
  for (const f of findings) {
    if (seen.has(f.rule)) continue;
    seen.set(f.rule, {
      id: f.rule,
      name: f.rule,
      shortDescription: { text: f.type },
      defaultConfiguration: { level: SEVERITY_TO_LEVEL[f.severity] },
    });
  }
  return Array.from(seen.values());
}

function toSarifResult(f: Finding): SarifResult {
  const region = f.line !== undefined ? { region: { startLine: f.line } } : {};
  return {
    ruleId: f.rule,
    level: SEVERITY_TO_LEVEL[f.severity],
    message: { text: f.description },
    locations: [
      {
        physicalLocation: {
          artifactLocation: { uri: pathToFileURL(f.file).href },
          ...region,
        },
      },
    ],
  };
}
