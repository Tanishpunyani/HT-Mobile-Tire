/**
 * Unit Test Runner
 * HT Mobile Services
 */

import { printSummaryAndExit, resetTestCounts } from "../helpers/test-runner.mjs";
import { runValidationTests } from "./validations.test.mjs";
import { runEtaTests } from "./eta.test.mjs";
import { runTechnicianTokenTests } from "./technician-token.test.mjs";
import { runAdminCookieTests } from "./admin-cookie.test.mjs";
import { runStateMachineTests } from "./state-machine.test.mjs";
import { runPaymentStateMachineTests } from "./payment-state-machine.test.mjs";
import { runCapacityTests } from "./capacity.test.mjs";
import { runSerializationTests } from "./serialization.test.mjs";
import { runNotificationRetryReliabilityTests } from "./notification-retry-reliability.test.mjs";
import { runMapsUnitTests } from "./maps.test.mjs";
import { runNotificationRecipientsUnitTests } from "./notification-recipients.test.mjs";
import { runNotificationIdentityUnitTests } from "./notification-identity.test.mjs";
import { runPhase4BWorkflowTests } from "./phase-4b-workflow.test.mjs";
import { runPhase4B3PhonePersistenceTests } from "./phase-4b3-phone-persistence.test.mjs";
import { runEmailServiceUnitTests } from "./email-service.test.mjs";
import { runEmailLifecycleRewiringUnitTests } from "./email-lifecycle-rewiring.test.mjs";
import { runEmergencyNotificationRenderingTests } from "./emergency-notification-rendering.test.mjs";
import { runEmailNotificationFixTests } from "./email-notification-fix.test.mjs";

console.log("\x1b[1m\x1b[35m==================================================\x1b[0m");
console.log("\x1b[1m\x1b[35m   RUNNING UNIT TEST SUITE (PHASE 7 & 10)        \x1b[0m");
console.log("\x1b[1m\x1b[35m==================================================\x1b[0m");

resetTestCounts();

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
runEmailServiceUnitTests();
runEmailLifecycleRewiringUnitTests();
runEmergencyNotificationRenderingTests();
runEmailNotificationFixTests();

printSummaryAndExit();
