/**
 * E2E Test Suite Runner
 * HT Mobile Services
 */

import { printSummaryAndExit, resetTestCounts } from "../helpers/test-runner.mjs";
import { runCustomerJourneyE2ETests } from "./customer-journey.test.mjs";
import { runAdminJourneyE2ETests } from "./admin-journey.test.mjs";
import { runTechnicianJourneyE2ETests } from "./technician-journey.test.mjs";
import { runLiveTrackingJourneyE2ETests } from "./live-tracking-journey.test.mjs";
import { runQuoteReceiptJourneyE2ETests } from "./quote-receipt-journey.test.mjs";
import { runReviewsJourneyE2ETests } from "./reviews-journey.test.mjs";
import { runCriticalNegativeFlowsE2ETests } from "./critical-negative-flows.test.mjs";

console.log("\x1b[1m\x1b[35m==================================================\x1b[0m");
console.log("\x1b[1m\x1b[35m   RUNNING E2E / JOURNEY TEST SUITE (PHASE 7)    \x1b[0m");
console.log("\x1b[1m\x1b[35m==================================================\x1b[0m");

resetTestCounts();

runCustomerJourneyE2ETests();
runAdminJourneyE2ETests();
runTechnicianJourneyE2ETests();
runLiveTrackingJourneyE2ETests();
runQuoteReceiptJourneyE2ETests();
runReviewsJourneyE2ETests();
runCriticalNegativeFlowsE2ETests();

setTimeout(() => {
  printSummaryAndExit();
}, 100);
