/**
 * Lightweight Deterministic Test Runner for HT Mobile Services
 * Supports assertions, test suites, timings, and aggregated summaries.
 */

let totalPassed = 0;
let totalFailed = 0;
let currentSuiteName = "";

export function describe(suiteName, fn) {
  currentSuiteName = suiteName;
  console.log(`\n\x1b[1m\x1b[36m=== [SUITE] ${suiteName} ===\x1b[0m`);
  fn();
}

export function test(testName, fn) {
  try {
    fn();
    console.log(`  \x1b[32m✓ [PASS]\x1b[0m ${testName}`);
    totalPassed++;
  } catch (error) {
    console.error(`  \x1b[31m✗ [FAIL]\x1b[0m ${testName}`);
    console.error(`    \x1b[90m${error.message}\x1b[0m`);
    totalFailed++;
  }
}

export async function testAsync(testName, asyncFn) {
  try {
    await asyncFn();
    console.log(`  \x1b[32m✓ [PASS]\x1b[0m ${testName}`);
    totalPassed++;
  } catch (error) {
    console.error(`  \x1b[31m✗ [FAIL]\x1b[0m ${testName}`);
    console.error(`    \x1b[90m${error.message}\x1b[0m`);
    totalFailed++;
  }
}

export function assert(condition, message) {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
}

export function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(
      `${message || "Assertion failed"}: expected [${expected}], got [${actual}]`
    );
  }
}

export function assertDeepEqual(actual, expected, message) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(
      `${message || "Deep equality failed"}:\n  Expected: ${expectedStr}\n  Actual:   ${actualStr}`
    );
  }
}

export function assertThrows(fn, message) {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  if (!threw) {
    throw new Error(message || "Expected function to throw, but it succeeded");
  }
}

export async function assertRejects(asyncFn, message) {
  let threw = false;
  try {
    await asyncFn();
  } catch {
    threw = true;
  }
  if (!threw) {
    throw new Error(message || "Expected async function to reject, but it succeeded");
  }
}

export function getTestSummary() {
  return {
    passed: totalPassed,
    failed: totalFailed,
    total: totalPassed + totalFailed,
  };
}

export function resetTestCounts() {
  totalPassed = 0;
  totalFailed = 0;
}

export function printSummaryAndExit() {
  console.log(`\n\x1b[1m--------------------------------------------------\x1b[0m`);
  console.log(
    `\x1b[1mTotal Tests:\x1b[0m ${totalPassed + totalFailed} | ` +
      `\x1b[32mPassed: ${totalPassed}\x1b[0m | ` +
      `\x1b[31mFailed: ${totalFailed}\x1b[0m`
  );
  console.log(`\x1b[1m--------------------------------------------------\x1b[0m\n`);
  if (totalFailed > 0) {
    process.exit(1);
  }
}
