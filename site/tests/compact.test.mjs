import assert from "node:assert/strict";
import { test } from "node:test";
import { compact } from "../src/lib/compact.ts";

const source = {
  id: "decp",
  shortName: "DECP",
  name: "Données essentielles de la commande publique",
  publisher: "Publisher",
  pageUrl: "https://example.org/page",
  fileUrl: "https://example.org/file",
  recordUrl: "https://example.org/{id}",
  codeUrl: null,
  licence: { name: "Licence Ouverte 2.0", url: "https://example.org/licence" },
  frequency: "Quotidienne",
  dataDate: "2026-11-01",
  freshness: "à jour",
  downloadExpected: true,
  usage: "Usage",
  limits: ["Limit"],
  retrievedAt: "2026-11-02T00:00:00+00:00",
  checkedAt: "2026-11-02T00:00:00+00:00",
  refreshFailed: false,
  publishedAt: null,
  coverage: "Coverage",
  rows: 10,
  sha256: "0".repeat(64),
  value: null,
};

test("cites each source once by id and keeps record links and data dates", () => {
  assert.deepEqual(
    compact({
      contracts: {
        provenance: {
          citations: [{ source, recordUrl: "https://example.org/1" }],
          method: "Method",
          calculationUrl: "https://example.org/sql",
        },
      },
      evidence: { source, recordUrl: null },
    }),
    {
      contracts: {
        provenance: {
          citations: [
            { source: "decp", recordUrl: "https://example.org/1", dataDate: "2026-11-01" },
          ],
          method: "Method",
          calculationUrl: "https://example.org/sql",
        },
      },
      evidence: { source: "decp", recordUrl: null, dataDate: "2026-11-01" },
      sources: {
        decp: {
          id: "decp",
          shortName: "DECP",
          name: "Données essentielles de la commande publique",
          publisher: "Publisher",
          pageUrl: "https://example.org/page",
          fileUrl: "https://example.org/file",
          licence: { name: "Licence Ouverte 2.0", url: "https://example.org/licence" },
          dataDate: "2026-11-01",
          coverage: "Coverage",
        },
      },
    },
  );
});

test("rounds fractions without touching integers or euro cents, and drops map drawing", () => {
  assert.deepEqual(
    compact({
      perCapita: 1703.4363502254646,
      ratio: 0.123456789,
      spent: 578038661317.33,
      year: 2025,
      label: "1703.4363502254646",
      location: { outline: "M0 0", viewBox: "0 0 1 1" },
    }),
    {
      perCapita: 1703.44,
      ratio: 0.123457,
      spent: 578038661317.33,
      year: 2025,
      label: "1703.4363502254646",
      location: {},
      sources: {},
    },
  );
});
