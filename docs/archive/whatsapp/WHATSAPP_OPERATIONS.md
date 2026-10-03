# HT Mobile Tyres — WhatsApp Production Operations Guide

This guide describes the operational architecture, Meta Developer Portal configuration, deployment requirements, security controls, and troubleshooting procedures for the WhatsApp Coexistence Chatbot on the HT Mobile Tyres platform.

---

## A. System Overview

The WhatsApp subsystem is built as a coexistence model providing deterministic self-service automation while allowing customer support staff to seamlessly take over, converse directly, and return conversations to the automated assistant.

### Architecture Pipeline

```
[ Customer WhatsApp Client ]
            │
            ▼ (Inbound HTTPS Webhook)
[ /api/webhooks/whatsapp (POST) ]
  ├── 1. HMAC-SHA256 Signature Verification (WHATSAPP_APP_SECRET)
  ├── 2. Business-side Echo & Loop Defense (rawFrom vs Business Identity)
  ├── 3. WAMID Deduplication & Database Persistence (WhatsAppMessage)
  ├── 4. Immediate HTTP 200 Acknowledgment to Meta
  └── 5. Decoupled Next.js after() Background Task
            │
            ▼
[ lib/whatsapp/context.ts (Customer Context Resolver) ]
  ├── Resolves verified Customer identity across international phone variants
  ├── Maps Active Bookings (handles 0, 1, or multiple ambiguous bookings)
  ├── Enforces Technician Privacy (personal phone omitted, raw GPS suppressed)
  └── Evaluates Cancellation & Rescheduling Business Rules
            │
            ▼
[ lib/whatsapp/router.ts (Deterministic Response Router) ]
  ├── Classifies 12 deterministic intents (Emergency, Status, ETA, Receipts, etc.)
  ├── Multi-turn booking disambiguation (Reference #, vehicle, index)
  ├── Persists validated activeBookingId on selection
  └── Suppresses automated replies during 'human_handoff' state
            │
            ▼
[ lib/notifications/whatsapp.ts (dispatchWhatsAppDirect) ]
  └── Outbound Meta WhatsApp Cloud API (Graph API v20.0) / Simulated Mode
            ▲
            │ (Human Outbound Replies)
[ /admin/whatsapp & actions/whatsapp.ts ]
  ├── Authenticated staff portal (requireAdminSession)
  ├── Active booking switching & manual customer-scoped association
  ├── Direct dynamic link: /admin/bookings/[bookingId]
  ├── Status management (Take Over, Return to Bot, Close)
  └── 150-message transcript safety ceiling (chronologically preserved)
```

---

## B. Meta Developer Portal Setup

Follow these exact steps in the [Meta for Developers Portal](https://developers.facebook.com/apps/):

### 1. Meta App & Product Configuration
1. Log in to the Meta for Developers console and select or create your **Business** type application.
2. Under **Add Products to Your App**, locate **WhatsApp** and click **Set up**.
3. Under the WhatsApp sidebar, navigate to **API Setup**.
4. Note your **Phone Number ID** and **WhatsApp Business Account ID (WABA ID)**.
5. Create a permanent System User in Meta Business Suite with `whatsapp_business_messaging` and `whatsapp_business_management` permissions to generate a non-expiring `WHATSAPP_ACCESS_TOKEN`.

### 2. Webhook Configuration
1. In the WhatsApp sidebar, navigate to **Configuration**.
2. Click **Edit** next to **Webhook**.
3. Enter your **Callback URL**:
   ```
   https://<your-production-domain>/api/webhooks/whatsapp
   ```
4. Enter your **Verify Token** (matching the value configured in `WHATSAPP_VERIFY_TOKEN`).
5. Click **Verify and Save**. Meta will issue a `GET` challenge to your endpoint.
6. Under **Webhook Fields**, click **Manage** and subscribe to:
   - `messages`: Required for receiving inbound customer messages and button/interactive responses.
   - `message_deliveries` (or message statuses in payload): Required for tracking real-time status updates (`sent`, `delivered`, `read`, `failed`).

### 3. App Secret Retrieval
1. In the Meta Developer portal, navigate to **App Settings** > **Basic**.
2. Locate **App Secret** (click *Show*).
3. Configure this value as `WHATSAPP_APP_SECRET` to enable cryptographic HMAC-SHA256 signature verification for every incoming webhook request.

---

## C. Environment Variables

All WhatsApp-related environment variables are defined below.

> [!CAUTION]
> **Server-Only Security Rule:** `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, and `WHATSAPP_VERIFY_TOKEN` contain sensitive cryptographic keys and permanent access credentials. They must **NEVER** be prefixed with `NEXT_PUBLIC_` or exposed in client-side code bundles.

| Variable Name | Purpose | Required? | Scope | Production Considerations |
|---|---|---|---|---|
| `WHATSAPP_ACCESS_TOKEN` | Meta Graph API permanent bearer token | Required | Server-only | Generate using a Meta Business System User. Temporary user tokens expire in 24 hours. |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta asset ID for the business phone | Required | Server-only | Found in Meta WhatsApp API Setup. Numeric identifier (e.g. `109876543210`). |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Meta WhatsApp Business Account ID | Required | Server-only | Identifies business account ownership. Found in API Setup. |
| `WHATSAPP_VERIFY_TOKEN` | Shared secret for GET challenge verification | Required | Server-only | Arbitrary cryptographically secure string (e.g. `openssl rand -hex 24`). |
| `WHATSAPP_APP_SECRET` | Secret used to verify incoming POST signatures | Required | Server-only | Copied from Meta App Settings > Basic. Enforces timing-safe HMAC validation. |
| `WHATSAPP_ENABLED` | Controls live dispatch vs simulation mode | Optional | Server-only | Defaults to `false`. Set to `"true"` in production to dispatch actual messages via Meta API. |
| `WHATSAPP_API_VERSION` | Meta Graph API version | Optional | Server-only | Defaults to `"v20.0"`. Only change if testing newer Meta API releases. |
| `NEXT_PUBLIC_APP_URL` | Base application URL | Required | Public-safe | Fully qualified production URL (e.g. `https://mobiletire.clinic`). Used for tracking & receipts. |
| `NEXT_PUBLIC_BUSINESS_PHONE` | Business phone in E.164 format | Optional | Public-safe | Defaults to `+18005558473`. Used for call hotline links. |
| `NEXT_PUBLIC_BUSINESS_PHONE_DISPLAY` | Human-readable business phone format | Optional | Public-safe | Defaults to `(800) 555-TIRE (8473)`. Used in bot text replies. |

---

## D. Production Webhook URL

The production callback URL must be constructed using the HTTPS protocol and the verified production deployment domain:

```
https://<your-verified-domain>/api/webhooks/whatsapp
```

### Critical Webhook Requirements:
1. **Public Accessibility**: Meta Cloud servers must be able to reach this endpoint over the public internet. Local `localhost` URLs cannot receive webhooks without tunneling (e.g. Cloudflare Tunnels, ngrok).
2. **HTTPS Protocol**: Meta strictly rejects plain `http://` callback endpoints. Valid SSL/TLS certificates are mandatory.
3. **Endpoint Path**: Must be exactly `/api/webhooks/whatsapp`.

---

## E. Verification Procedure

Run through this procedure during staging or initial deployment to verify that all components are functioning as intended:

### 1. Configuration Check
Run the read-only configuration checker:
```bash
node --env-file=frontend/.env.local backend/scripts/verify-whatsapp-config.mjs
```
Confirm output reports:
`✓ ALL REQUIRED PRODUCTION CONFIGURATION ITEMS ARE SATISFIED.`

### 2. GET Challenge Verification
Test webhook verification with a simulated Meta challenge:
```bash
curl -i "https://<your-domain>/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=<YOUR_VERIFY_TOKEN>&hub.challenge=test_challenge_12345"
```
- **Expected Result**: HTTP 200 OK with response body `test_challenge_12345` and `Content-Type: text/plain`.

### 3. Inbound Ingestion & HMAC Verification
When a customer sends a message to the business WhatsApp phone:
- Webhook receives POST with `x-hub-signature-256` header.
- Endpoint validates HMAC, records message to `WhatsAppMessage` with direction `inbound`, and returns HTTP 200.

### 4. Deterministic Bot Reply
- Next.js `after()` processes the message asynchronously.
- Bot evaluates context and intent, produces customer-safe response, and dispatches via Meta Cloud API.
- Outbound reply is persisted to `WhatsAppMessage` with direction `outbound` and `rawPayload.source = "deterministic_router"`.

### 5. Multi-Booking Disambiguation & Persistence
- If customer has 2+ active bookings, bot prompts: `You currently have 2 active bookings...`.
- Customer replies with reference (e.g. `#A1B2C3D4`), vehicle, or index.
- Context resolver validates ownership and persists target booking to `WhatsAppConversation.activeBookingId`.
- Follow-up turns immediately use the selected booking without re-prompting.

### 6. Human Handoff Workflow
- Customer types `agent`, `human`, or `support`.
- Status transitions to `human_handoff`, bot replies are suppressed.
- Admin opens `/admin/whatsapp`, views conversation with unread badge, and takes over by sending a direct reply.
- Message is sent with `rawPayload.source = "admin"`.
- Admin can click **Return to Bot** or customer can send `bot` / `restart` to resume automated replies.

### 7. Delivery Status Updates
- When Meta posts status updates (`sent`, `delivered`, `read`), `route.ts` matches the `wamid` and updates both `NotificationLog` and `WhatsAppMessage.rawPayload.deliveryStatus`.
- Admin UI renders double checkmarks: gray (sent), green (delivered), blue (read).

### 8. Business-Number Echo Protection
- Outbound messages from the business number sent via external interfaces are filtered by the `isBusinessEcho` guard in `route.ts` without triggering automated bot responses or infinite loops.

---

## F. 24-Hour Messaging Window & Meta Policy

Meta enforces a strict **24-hour Customer Service Window**:
- Businesses may send free-form plain-text messages to a customer within 24 hours of the customer's last incoming message.
- After 24 hours have elapsed without a customer response, plain-text messages are rejected by Meta with **Error 131047** (`Re-engagement message`).

### Current System Behavior
1. In `/admin/whatsapp`, if `lastMessageAt` is older than 24 hours, an amber notice appears:
   *"Notice: It has been over 24 hours since the customer last messaged. Plain-text replies may fail if the Meta 24-hour service window has elapsed."*
2. If staff attempts to send a plain-text reply after expiration, the error is intercepted and translated into a friendly notice:
   *"Meta Cloud API Policy: The 24-hour customer service window has expired. You cannot send plain-text messages until the customer messages again or an approved template is sent."*
3. The platform intentionally avoids sending unapproved ad-hoc templates to prevent WhatsApp Business account policy violations. For critical updates outside the window, use phone or transactional email.

---

## G. Failure Troubleshooting

### 1. Webhook Verification Failure (HTTP 403 Forbidden)
- **Cause**: `hub.verify_token` sent by Meta does not match `WHATSAPP_VERIFY_TOKEN` in application environment.
- **Solution**: Verify the token string in Meta App Dashboard > WhatsApp > Configuration matches `WHATSAPP_VERIFY_TOKEN` exactly.

### 2. Invalid HMAC Signature (HTTP 401 Unauthorized)
- **Cause**: `x-hub-signature-256` header does not match expected SHA-256 digest calculated using `WHATSAPP_APP_SECRET`.
- **Solution**: Check that `WHATSAPP_APP_SECRET` in `.env` matches **App Secret** in Meta App Settings > Basic. Ensure reverse proxies (Nginx/Cloudflare) do not modify raw request bodies.

### 3. Outbound Message Fails with Meta Error 131047
- **Cause**: Customer has not messaged in the past 24 hours.
- **Solution**: Free-form text cannot be sent. Contact customer via phone, SMS, or email, or await customer inbound message.

### 4. Outbound Message Fails with Meta Error 131030 (Recipient Not Allowed)
- **Cause**: WhatsApp App is in Development mode, and the recipient phone number has not been added to the Meta Developer Portal **To** number test list.
- **Solution**: Add the phone number to the allowed test numbers in Meta API Setup, or switch the Meta App to **Live** mode.

### 5. Inbound Customer Message Stored but Bot Does Not Reply
- **Cause 1**: `WHATSAPP_ENABLED` is set to `"false"` or omitted (operating in simulation mode). Check logs for `whatsapp.message.simulated`.
- **Cause 2**: Conversation status is `human_handoff`. Check logs for `whatsapp.router.suppressed_for_handoff`.
- **Cause 3**: Sender is detected as the business phone. Check logs for `whatsapp.webhook.business_echo_suppressed`.

### 6. Customer With Multiple Active Bookings Receives Disambiguation
- **Expected Behavior**: When a customer has multiple appointments, the system will not guess which appointment to reference. The customer must reply with their `#REFERENCE` or option index. Staff can also manually set the active booking in `/admin/whatsapp`.

### 7. Duplicate Webhook Deliveries
- **Expected Behavior**: Meta retries webhooks if acknowledgment takes > 3 seconds. The system enforces WAMID deduplication via `prisma.whatsAppMessage.findUnique` and catches database unique constraint `P2002`, logging `whatsapp.inbound.duplicate` safely without processing duplicate replies.

---

## H. Security & Privacy Rules

Operational staff and developers must adhere to these strict rules:

1. **Never Expose Private Credentials**: Never commit `.env.local` or print `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, or `WHATSAPP_VERIFY_TOKEN` in client components, API responses, or support tickets.
2. **Customer Phone Privacy**: Logs must only contain masked phone numbers (`maskPhoneForLogging()`, e.g. `***-***-1234`).
3. **Technician Phone Privacy**: Technician personal telephone numbers must never be included in customer context or dispatched in bot messages.
4. **GPS Telemetry Privacy**: Never expose raw GPS latitude/longitude coordinates, speed, or heading in WhatsApp messages. Only calculated arrival estimates (`CustomerEtaResult`) and authorized tracking URLs (`/technician/tracking/[bookingId]`) may be shared.
5. **No IDOR Bypasses**: Never bypass customer ownership checks when associating bookings in `/admin/whatsapp`. The server strictly enforces that candidate bookings belong to the customer owning the phone number.
6. **No Synthetic Customer Creation**: The webhook must never automatically create arbitrary `Customer` database entities for unknown numbers.

---

## I. Production Deployment Checklist

Before enabling live WhatsApp communications in production, verify each item:

- [ ] `WHATSAPP_ACCESS_TOKEN` configured from a non-expiring System User
- [ ] `WHATSAPP_PHONE_NUMBER_ID` configured and verified against Meta phone number
- [ ] `WHATSAPP_BUSINESS_ACCOUNT_ID` configured
- [ ] `WHATSAPP_VERIFY_TOKEN` configured with a strong random secret
- [ ] `WHATSAPP_APP_SECRET` configured from Meta App Dashboard
- [ ] `WHATSAPP_ENABLED="true"` set intentionally in production environment
- [ ] `NEXT_PUBLIC_APP_URL` configured with valid HTTPS domain (e.g. `https://mobiletire.clinic`)
- [ ] Webhook URL `https://<domain>/api/webhooks/whatsapp` configured in Meta Portal
- [ ] Webhook field `messages` subscribed in Meta Portal
- [ ] Webhook field `message_deliveries` subscribed in Meta Portal
- [ ] Configuration verified using `node backend/scripts/verify-whatsapp-config.mjs`
- [ ] Next.js production build passes cleanly (`npm run build`)
- [ ] Master test suite passes cleanly (`npm test`)
- [ ] Admin portal `/admin/whatsapp` accessible and protected by `requireAdminSession()`
- [ ] Staff trained on the 24-hour service window and human handoff controls
