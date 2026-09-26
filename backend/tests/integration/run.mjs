/**
 * Integration Test Runner
 * HT Mobile Services
 */

import { printSummaryAndExit, resetTestCounts } from "../helpers/test-runner.mjs";
import { runCustomerAuthIntegrationTests } from "./customer-auth.test.mjs";
import { runIdorIntegrationTests } from "./idor-protection.test.mjs";
import { runAdminAuthIntegrationTests } from "./admin-auth.test.mjs";
import { runTechnicianAuthIntegrationTests } from "./technician-auth.test.mjs";
import { runConcurrencyIntegrationTests } from "./concurrency.test.mjs";
import { runTrackingPrivacyIntegrationTests } from "./tracking-privacy.test.mjs";
import { runCancellationDeletionIntegrationTests } from "./cancellation-deletion.test.mjs";
import { runApiContractIntegrationTests } from "./api-contracts.test.mjs";
import { runNotificationsResilienceIntegrationTests } from "./notifications-resilience.test.mjs";

console.log("\x1b[1m\x1b[35m==================================================\x1b[0m");
console.log("\x1b[1m\x1b[35m   RUNNING INTEGRATION TEST SUITE (PHASE 7)      \x1b[0m");
console.log("\x1b[1m\x1b[35m==================================================\x1b[0m");

resetTestCounts();

runCustomerAuthIntegrationTests();
runIdorIntegrationTests();
runAdminAuthIntegrationTests();
runTechnicianAuthIntegrationTests();
runConcurrencyIntegrationTests();
runTrackingPrivacyIntegrationTests();
runCancellationDeletionIntegrationTests();
runApiContractIntegrationTests();
runNotificationsResilienceIntegrationTests();

// Allow async tests to settle
setTimeout(() => {
  printSummaryAndExit();
}, 100);
