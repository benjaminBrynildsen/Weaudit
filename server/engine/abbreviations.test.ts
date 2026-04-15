/**
 * Smoke test for expandAbbreviations. No external test framework —
 * self-contained so it runs via `tsx` without adding deps. Run with
 * `npm test` (or directly: `npx tsx server/engine/abbreviations.test.ts`).
 *
 * expandAbbreviations returns the original line plus all pattern/word
 * expansion variants concatenated with spaces. Tests assert the
 * expected normalized form appears as a substring of the output so
 * downstream keyword matching can hit any variant.
 */

import { strict as assert } from "node:assert";
import { expandAbbreviations } from "./abbreviations";

function run(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

function contains(haystack: string, needle: string, label: string) {
  assert.ok(
    haystack.includes(needle),
    `${label}: expected output to contain "${needle}" — got: ${haystack}`,
  );
}

console.log("expandAbbreviations");

run("TR1 → T1 variant produced", () => {
  const out = expandAbbreviations("VI-BUSINESS CARD TR1 LEVEL 2");
  contains(out, "VI-BUSINESS CARD T1 LEVEL 2", "TR1→T1");
});

run("LVL 2 → LEVEL 2 variant produced", () => {
  const out = expandAbbreviations("MC BUS LVL 2 DATA RATE 1");
  contains(out, "LEVEL 2", "LVL→LEVEL");
});

run("PRD 1 → PRODUCT 1 variant produced", () => {
  const out = expandAbbreviations("VISA CORPORATE PRD 1");
  contains(out, "PRODUCT 1", "PRD→PRODUCT");
});

run("TR1..TR5 all expand", () => {
  for (let i = 1; i <= 5; i++) {
    const out = expandAbbreviations(`FOO TR${i} BAR`);
    contains(out, `FOO T${i} BAR`, `TR${i}→T${i}`);
  }
});

run("COMM → COMMERCIAL variant produced", () => {
  const out = expandAbbreviations("BUS COMM CARD");
  contains(out, "COMMERCIAL", "COMM→COMMERCIAL");
});

run("CNP → CARD NOT PRESENT variant produced", () => {
  const out = expandAbbreviations("VI CNP QUAL");
  contains(out, "CARD NOT PRESENT", "CNP→CARD NOT PRESENT");
});

run("passthrough preserves original line", () => {
  const s = "VI-CPS RETAIL QUAL";
  const out = expandAbbreviations(s);
  contains(out, s, "passthrough");
});

if (process.exitCode && process.exitCode !== 0) {
  console.error("\nexpandAbbreviations: FAILED");
} else {
  console.log("\nexpandAbbreviations: OK");
}
