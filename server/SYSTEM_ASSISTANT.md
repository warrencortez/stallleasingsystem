Dela Costa HOA Stall Leasing includes a local, read-only chatbot at `POST /api/v1/assistant`.

Send `{ "message": "Which stalls are available?" }` with the existing bearer token. Questions must contain 1–500 characters. The response includes `reply`, `topic`, suggested questions, and (for data lookups) a check timestamp.

Supported topics: available/occupied/reserved stalls; unpaid and overdue invoice dates; maintenance status and priority; lease records; applications; announcements; recorded billing summaries; basic navigation help. Administrators/staff can ask across records. Tenants can read only records attached to their authenticated user ID, except public stall information and tenant announcements. Missing lease links never grant broader access. Examples: “due dates for Ana”, “maintenance reports for A-101”, “pending applications”.

This is an intent-based system chatbot, not a general-purpose language model. It requires no AI subscription, API key, internet search, or transmission to an external AI service. Unsupported questions receive a scope-limited response. It cannot change records or execute instructions found in messages or stored records. Each question is interpreted independently; there is no conversational inference across previous messages. Summaries cover the matching stored records, not arbitrary historical periods.

The website and Expo tenant app show a floating circular chat head after sign-in. The administrator's own Assistant tab remains session-local. Tenant conversations now persist across sign-outs and backend restarts, including bot replies, live-agent requests, administrator messages and handoff events. Earlier tenant bot messages were never saved on the server and cannot be recovered by this update.

Mobile bot replies show animated dots and “Assistant is typing…” for a minimum of 1.2–2.2 seconds, depending on question length; a slower API response extends the wait naturally. Reduced-motion settings disable the dot animation. Human messages are not artificially delayed. Closing the panel keeps the conversation; the floating head shows unread replies. Background polling pauses when the app is inactive.

Tenants can tap **Talk to an admin**. This places the conversation in `waiting`, pauses bot replies and creates a normal in-app notification for active administrators/staff. Tenants can leave more messages while waiting or cancel the request. The website has a **Tenant Conversations** page and a **Tenant inbox** tab inside its floating chat panel. Both list all tenant login accounts, including tenants with no previous messages, so an administrator can initiate a chat. Search, waiting filters, unread badges and request alerts are included.

An administrator selects a tenant and clicks **Accept request** or **Take over chat** before replying. Exactly one agent owns a live conversation; other admins can view its history but cannot silently overwrite ownership or send as that agent. **Return to assistant** ends the handoff without deleting history. The tenant can also return to the assistant. In-flight bot replies are suppressed if a handoff occurs, and retried message requests use idempotency keys to avoid duplicates.

Support endpoints (all authenticated):

| Method / path | Purpose |
|---|---|
| `GET /api/v1/support/thread?read=true` | Tenant's own conversation; `read=true` marks the returned messages seen |
| `POST /api/v1/support/messages` | Tenant message: `{ message, client_id }` |
| `POST /api/v1/support/request-agent` | Idempotent request for a live agent |
| `POST /api/v1/support/resume` | Tenant returns to bot mode |
| `GET /api/v1/support/inbox` | Admin/staff tenant list and queue |
| `GET /api/v1/support/threads/:tenantId?read=true` | Authorized conversation history |
| `POST /api/v1/support/threads/:tenantId/claim` | Atomically claim a tenant conversation |
| `POST /api/v1/support/threads/:tenantId/messages` | Assigned administrator's message: `{ message, client_id }` |
| `POST /api/v1/support/threads/:tenantId/resume` | Return conversation to assistant |

Support messages accept 1–1,000 characters. Client IDs contain 8–100 letters, numbers, underscores or hyphens. Tenants cannot list the inbox or access another tenant's thread. The admin inbox polls every four seconds; an open thread and mobile chat poll every three seconds. Alerts are in-app, not OS push notifications when apps are closed. A persisted waiting request remains visible in the inbox even if the older notification subsystem fails.

Conversation storage is `server/data/support-chat.json`, excluded from Git and public uploads. Writes use a serialized queue and atomic replacement; failed writes are reported, never silently accepted into volatile memory. No SQL migration is required. `SUPPORT_CHAT_FILE` can point to another private persistent path. This store supports one Node server process: back it up, retain it during deployments, and use shared transactional database storage before running multiple workers/instances. The supplied nodemon configuration watches code only so chat writes do not restart development servers.

The assistant uses the existing repository data source, including its development fallback behavior. It cannot make that source durable or correct, and it does not fix the pre-existing authentication/payment issues documented in `qa/QA_REPORT.md`. It independently filters private results so fallback query filtering cannot widen the assistant's tenant access.

Run focused checks from the server directory with `node --test test/systemAssistant.test.js test/support.test.js`. Restart the backend after adding the new routes; reload/restart the web and Expo apps to receive UI updates. Native installed launcher names require a rebuilt binary. Existing Expo slug and Android package ID are retained to preserve app identity.
