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
import { runBugfixAuditRegressionTests } from "./bugfix-audit-regression.test.mjs";
import { runAdminRenderingLoopRegressionTests } from "./admin-rendering-loop.test.mjs";
import { runMarkArrivedDualAuthRegressionTests } from "./mark-arrived-dual-auth.test.mjs";
import { runPrismaDecimalSerializationRegressionTests } from "./prisma-decimal-serialization.test.mjs";
import { runPhase6BLifecycleTests } from "./phase-6b-lifecycle.test.mjs";
import { runPhase6DPaymentHardeningTests } from "./phase-6d-payment-hardening.test.mjs";
import { runPhase6FCustomerHardeningTests } from "./phase-6f-customer-hardening.test.mjs";
import { runPhase6HAdminOperationalTests } from "./phase-6h-admin-operational.test.mjs";

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
runBugfixAuditRegressionTests();
runAdminRenderingLoopRegressionTests();
runMarkArrivedDualAuthRegressionTests();
runPrismaDecimalSerializationRegressionTests();
runPhase6BLifecycleTests();
runPhase6DPaymentHardeningTests();
runPhase6FCustomerHardeningTests();
runPhase6HAdminOperationalTests();

// Allow async tests to settle
setTimeout(() => {
  printSummaryAndExit();
}, 150);
