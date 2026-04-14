/**
 * Smoke test for expandAbbreviations. No external test framework —
 * self-contained so it runs via `tsx` without adding deps. Run with
 * `npm test` (or directly: `npx tsx server/engine/abbreviations.test.ts`).
 *
 * If any assertion fails, the script exits non-zero and CI catches it.
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

console.log("expandAbbreviations");

// User-specified golden cases.
run("TR1 → T1", () => {
  assert.equal(
    expandAbbreviations("VI-BUSINESS CARD TR1 LEVEL 2"),
    "VI-BUSINESS CARD T1 LEVEL 2",
  );
});

run("LVL 2 → LEVEL 2", () => {
  assert.equal(
    expandAbbreviations("MC BUS LVL 2 DATA RATE 1"),
    "MC BUS LEVEL 2 DATA RATE 1",
  );
});

run("PRD 1 → PRODUCT 1", () => {
  assert.equal(
    expandAbbreviations("VISA CORPORATE PRD 1"),
    "VISA CORPORATE PRODUCT 1",
  );
});

// Full TR range (benchmarks.ts uses TR1..TR5).
run("TR1..TR5 all expand", () => {
  for (let i = 1; i <= 5; i++) {
    assert.equal(
      expandAbbreviations(`FOO TR${i} BAR`),
      `FOO T${i} BAR`,
    );
  }
});

// Word boundary guards — must not mangle unrelated tokens.
run("does not touch TRACK", () => {
  assert.equal(expandAbbreviations("CARD TRACK 2"), "CARD TRACK 2");
});

run("does not touch LEVEL (already expanded)", () => {
  assert.equal(expandAbbreviations("LEVEL 2"), "LEVEL 2");
});

run("does not touch substring like STR1", () => {
  assert.equal(expandAbbreviations("FOO STR1 BAR"), "FOO STR1 BAR");
});

// Case-insensitive matching, uppercase output.
run("handles lowercase input", () => {
  assert.equal(expandAbbreviations("bus tr1 lvl 2"), "bus T1 LEVEL 2");
});

// Identity when no abbreviations present.
run("passthrough for plain text", () => {
  const s = "VI-CPS RETAIL QUAL";
  assert.equal(expandAbbreviations(s), s);
});

if (process.exitCode && process.exitCode !== 0) {
  console.error("\nexpandAbbreviations: FAILED");
} else {
  console.log("\nexpandAbbreviations: OK");
}
