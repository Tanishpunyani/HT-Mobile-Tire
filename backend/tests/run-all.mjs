/**
 * Master Automated Regression Test Suite
 * HT Mobile Services / Tire Mobile Clinic
 *
 * Runs:
 * - Unit Test Suite (Validations, ETA, Security Tokens, Admin Cookies, State Machines, Capacity, Serialization)
 * - Integration Test Suite (Customer Auth, IDOR Isolation, Admin Auth, Tech Auth, Concurrency, Tracking Privacy, Deletion Safety, API Contracts, Notification Resilience)
 * - E2E Journeys (Customer, Admin, Technician, Live Tracking, Quote/PDF, Reviews, Negative Flows)
 */

import { printSummaryAndExit, resetTestCounts } from "./helpers/test-runner.mjs";

// Unit Suites
import { runValidationTests } from "./unit/validations.test.mjs";
import { runEtaTests } from "./unit/eta.test.mjs";
import { runTechnicianTokenTests } from "./unit/technician-token.test.mjs";
import { runAdminCookieTests } from "./unit/admin-cookie.test.mjs";
import { runStateMachineTests } from "./unit/state-machine.test.mjs";
import { runPaymentStateMachineTests } from "./unit/payment-state-machine.test.mjs";
import { runCapacityTests } from "./unit/capacity.test.mjs";
import { runSerializationTests } from "./unit/serialization.test.mjs";
import { runNotificationRetryReliabilityTests } from "./unit/notification-retry-reliability.test.mjs";
import { runMapsUnitTests } from "./unit/maps.test.mjs";
import { runNotificationRecipientsUnitTests } from "./unit/notification-recipients.test.mjs";
import { runNotificationIdentityUnitTests } from "./unit/notification-identity.test.mjs";
import { runPhase4BWorkflowTests } from "./unit/phase-4b-workflow.test.mjs";
import { runPhase4B3PhonePersistenceTests } from "./unit/phase-4b3-phone-persistence.test.mjs";
import { runWhatsAppWorkflowCompletionUnitTests } from "./unit/whatsapp-workflow-completion.test.mjs";
import { runWhatsAppInboundWebhookUnitTests } from "./unit/whatsapp-inbound-webhook.test.mjs";
import { runWhatsAppContextResolverUnitTests } from "./unit/whatsapp-context-resolver.test.mjs";

// Integration Suites
import { runCustomerAuthIntegrationTests } from "./integration/customer-auth.test.mjs";
import { runIdorIntegrationTests } from "./integration/idor-protection.test.mjs";
import { runAdminAuthIntegrationTests } from "./integration/admin-auth.test.mjs";
import { runTechnicianAuthIntegrationTests } from "./integration/technician-auth.test.mjs";
import { runConcurrencyIntegrationTests } from "./integration/concurrency.test.mjs";
import { runTrackingPrivacyIntegrationTests } from "./integration/tracking-privacy.test.mjs";
import { runCancellationDeletionIntegrationTests } from "./integration/cancellation-deletion.test.mjs";
import { runApiContractIntegrationTests } from "./integration/api-contracts.test.mjs";
import { runNotificationsResilienceIntegrationTests } from "./integration/notifications-resilience.test.mjs";
import { runBugfixAuditRegressionTests } from "./integration/bugfix-audit-regression.test.mjs";
import { runAdminRenderingLoopRegressionTests } from "./integration/admin-rendering-loop.test.mjs";
import { runMarkArrivedDualAuthRegressionTests } from "./integration/mark-arrived-dual-auth.test.mjs";
import { runPrismaDecimalSerializationRegressionTests } from "./integration/prisma-decimal-serialization.test.mjs";
import { runPhase6BLifecycleTests } from "./integration/phase-6b-lifecycle.test.mjs";
import { runPhase6DPaymentHardeningTests } from "./integration/phase-6d-payment-hardening.test.mjs";
import { runPhase6FCustomerHardeningTests } from "./integration/phase-6f-customer-hardening.test.mjs";
import { runPhase6HAdminOperationalTests } from "./integration/phase-6h-admin-operational.test.mjs";

// E2E Suites
import { runCustomerJourneyE2ETests } from "./e2e/customer-journey.test.mjs";
import { runAdminJourneyE2ETests } from "./e2e/admin-journey.test.mjs";
import { runTechnicianJourneyE2ETests } from "./e2e/technician-journey.test.mjs";
import { runLiveTrackingJourneyE2ETests } from "./e2e/live-tracking-journey.test.mjs";
import { runQuoteReceiptJourneyE2ETests } from "./e2e/quote-receipt-journey.test.mjs";
import { runReviewsJourneyE2ETests } from "./e2e/reviews-journey.test.mjs";
import { runCriticalNegativeFlowsE2ETests } from "./e2e/critical-negative-flows.test.mjs";

console.log("\x1b[1m\x1b[34m======================================================================\x1b[0m");
console.log("\x1b[1m\x1b[34m   HT MOBILE SERVICES — MASTER AUTOMATED REGRESSION SUITE (PHASE 7)  \x1b[0m");
console.log("\x1b[1m\x1b[34m======================================================================\x1b[0m");

resetTestCounts();

// 1. UNIT SUITES
runValidationTests();
runEtaTests();
runTechnicianTokenTests();
runAdminCookieTests();
runStateMachineTests();
runPaymentStateMachineTests();
runCapacityTests();
runSerializationTests();
runNotificationRetryReliabilityTests();
runMapsUnitTests();
runNotificationRecipientsUnitTests();
runNotificationIdentityUnitTests();
runPhase4BWorkflowTests();
runPhase4B3PhonePersistenceTests();
runWhatsAppWorkflowCompletionUnitTests();
runWhatsAppInboundWebhookUnitTests();
runWhatsAppContextResolverUnitTests();

// 2. INTEGRATION SUITES
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

// 3. E2E SUITES
runCustomerJourneyE2ETests();
runAdminJourneyE2ETests();
runTechnicianJourneyE2ETests();
runLiveTrackingJourneyE2ETests();
runQuoteReceiptJourneyE2ETests();
runReviewsJourneyE2ETests();
runCriticalNegativeFlowsE2ETests();

setTimeout(() => {
  printSummaryAndExit();
}, 150);
