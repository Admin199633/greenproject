# Quote Approval Link System ("שלח קישור אישור")

This document describes how the customer-facing quote approval link is generated, delivered, opened, and submitted. It is a factual map of the existing implementation — no code is being changed.

All file paths are relative to the repository root.

---

## 1. Feature overview

### What the "שלח קישור אישור" button does
The button is rendered inside the document detail page for the business owner. When clicked it:

1. Calls `POST /api/documents/[id]/approval-link` to mint a one-time approval token for the quote.
2. Receives back a public approval URL of the form `https://<host>/green/a/<rawToken>`.
3. Builds a Hebrew WhatsApp message from the business' configured template (or the default), and:
   - If the customer has a phone number, opens `https://api.whatsapp.com/send?phone=…&text=…` in a new tab so the owner can send the link via WhatsApp.
   - If there is no phone number, copies the URL to the clipboard and shows a toast.

The button label changes to "שולח..." while the request is in flight.

Source:
- `src/components/documents/DocumentShareActions.tsx` — button + click handler (label `שלח קישור אישור` at line 153, handler `handleSendApprovalLink` at lines 82–140).
- `src/app/(dashboard)/documents/[id]/page.tsx` — wires the button (`canCopyApprovalLink={showQuoteApproval && !doc.approvedAt}` at line 130).

### Who uses it
- **Business owner** (an authenticated user who owns a `Business`) presses the button on the quote detail page.
- **Customer** opens the link on the public approval page; no login is required.

### What customer flow it enables
The owner sends an issued QUOTE to the customer via WhatsApp. The customer opens the link, reviews the quote, types their full name, signs on a canvas, accepts the terms, and submits. The approval is recorded against the document and (when conditions are met) a Google Calendar event is created on the owner's calendar. The customer is then redirected back to WhatsApp with a pre-filled "approved" message to the owner.

---

## 2. Business flow

1. **Quote is created** — owner saves a `Document` with `type = QUOTE` (status `DRAFT`).
2. **Quote is issued** — `POST /api/documents/[id]/issue` calls `issueDraft(...)` and immediately attempts `mintQuoteApprovalToken(...)` for QUOTE documents (`src/app/api/documents/[id]/issue/route.ts:20-29`). The minted raw token is then passed to `sendDocumentEmail(...)` so it can be embedded in the issued-document email if SMTP is configured. Token-mint failures are logged but never block issuing.
3. **Approval token/link is generated on demand** — when the owner clicks "שלח קישור אישור", `POST /api/documents/[id]/approval-link` calls `mintQuoteApprovalToken(documentId, businessId)` again. This **overwrites** any previously stored hash with a fresh one (`src/services/document.service.ts:967-974`). The route returns `{ approvalUrl }` built by `buildApprovalUrl(rawToken, origin)`.
4. **Link is sent to customer** — the front-end opens a WhatsApp `wa.me` share URL pre-filled with a Hebrew template, or copies the URL to the clipboard if no phone exists.
5. **Customer opens the public approval page** — `GET /green/a/<token>` (or `/green/approve/<token>`). The page calls `findQuoteByApprovalToken(token)` and either renders the approval UI or an `InvalidTokenView`.
6. **Customer approves** — fills in name, signs the canvas, ticks the terms checkbox, and submits. The form `POST`s to `/api/public/approve/<token>`.
7. **Approval data is stored** — `recordQuoteApproval(...)` updates the `Document` row inside a Prisma transaction and:
   - tries to create a Google Calendar event on the owner's calendar (best-effort, non-blocking),
   - builds a `wa.me` redirect URL containing a pre-filled "approved" message to the business owner.
8. **Customer is redirected** — if a `whatsappRedirectUrl` is returned, the browser navigates to it; otherwise the success state is shown inline.

---

## 3. Technical flow

### Routes / pages
| Path | File | Purpose |
| --- | --- | --- |
| `/green/approve/[token]` | `src/app/approve/[token]/page.tsx` | Server-rendered public approval page |
| `/green/a/[token]` | `src/app/a/[token]/page.tsx` | Short alias — re-exports the same page (`export { dynamic, default } from "@/app/approve/[token]/page"`) |
| `/green/documents/[id]` | `src/app/(dashboard)/documents/[id]/page.tsx` | Owner view; renders `DocumentShareActions` which contains the "שלח קישור אישור" button |
| `/green/settings` | `src/app/(dashboard)/settings/page.tsx` + `BusinessSettingsForm.tsx` | Where the owner edits `approvalWhatsappMessageTemplate` |

`buildApprovalUrl()` always uses the **short** path (`/green/a/<token>`); the long `/green/approve/<token>` path resolves to the same handler.

### API endpoints
| Method | Path | File | Auth | Purpose |
| --- | --- | --- | --- | --- |
| `POST` | `/api/documents/[id]/approval-link` | `src/app/api/documents/[id]/approval-link/route.ts` | `requireBusiness()` | Mint a fresh approval token for an issued QUOTE; return `{ approvalUrl }` |
| `POST` | `/api/documents/[id]/issue` | `src/app/api/documents/[id]/issue/route.ts` | `requireBusiness()` | Issues the document; for QUOTEs, also mints an approval token and emails the link |
| `POST` | `/api/documents/[id]/send` | `src/app/api/documents/[id]/send/route.ts` | `requireBusiness()` | Resends the document email to the customer (re-mints a token via `sendDocumentEmail` if needed) |
| `POST` | `/api/public/approve/[token]` | `src/app/api/public/approve/[token]/route.ts` | **Public** (token-gated) | Records the customer approval |

### Services / functions
| Function | File / Lines | Purpose |
| --- | --- | --- |
| `generateApprovalToken()` | `src/lib/documents/approval.ts:28-35` | Generates `{ rawToken, tokenHash }` |
| `hashApprovalToken(raw)` | `src/lib/documents/approval.ts:37-39` | SHA-256 hex digest |
| `buildApprovalPath(raw)` | `src/lib/documents/approval.ts:41-43` | `/green/approve/<token>` |
| `buildShortApprovalPath(raw)` | `src/lib/documents/approval.ts:45-47` | `/green/a/<token>` |
| `buildApprovalUrl(raw, origin?)` | `src/lib/documents/approval.ts:49-52` | Absolute URL using short path. Falls back through `NEXTAUTH_URL`, request origin, then `https://liorsw.com` |
| `mintQuoteApprovalToken(documentId, businessId)` | `src/services/document.service.ts:939-977` | Validates the document, generates a token, stores its SHA-256 hash, returns the raw token |
| `findQuoteByApprovalToken(rawToken)` | `src/services/document.service.ts:984-1023` | Hashes the token, looks up the issued QUOTE, returns `null` for any mismatch (incl. expired) |
| `recordQuoteApproval(rawToken, input)` | `src/services/document.service.ts:1181-1258` | Re-hashes, reads-and-writes inside a Prisma transaction, then triggers calendar + WhatsApp redirect builders |
| `tryCreateOwnerCalendarEvent(documentId, rawToken)` | `src/services/document.service.ts:1085-1179` | Best-effort Google Calendar event creation; sets `googleCalendarEventId` on success |
| `buildOwnerApprovalWhatsappRedirectUrl(documentId)` | `src/services/document.service.ts:1260-1304` | Builds a `wa.me` URL the customer is redirected to after approving |
| `buildApprovalShareMessage(...)` | `src/lib/documents/delivery.ts:284-341` | Renders the WhatsApp message template (`{customerName}`, `{approvalUrl}`, `{eventDate}`, `{eventTime}`, `{eventLocation}`, `{businessName}`) |
| `buildWhatsappShareUrl(phone, message)` | `src/lib/documents/delivery.ts:411-415` | `https://api.whatsapp.com/send?phone=…&text=…` |
| `sendDocumentEmail(documentId, businessId, options)` | `src/services/email.service.ts:57-…` | Sends the issued-document email; for unapproved QUOTEs, mints a token if one was not passed in |

### Prisma models and fields
The whole feature lives on the `Document` model (no separate "Approval" table). See `prisma/schema.prisma:217-233`:

```
approvalTokenHash         String?     @db.VarChar // SHA-256 hex of active token
approvalTokenCreatedAt    DateTime?
approvalTokenExpiresAt    DateTime?
approvedAt                DateTime?
approvedByName            String?
approvalIp                String?
approvalUserAgent         String?
approvalSignatureDataUrl  String?     @db.Text
approvalTermsAccepted     Boolean     @default(false)
googleCalendarEventId     String?
```

There is also an index on `approvalTokenHash` (`prisma/schema.prisma:245`) to support the public lookup.

### How token generation works
1. `generateApprovalToken()` calls `randomBytes(32).toString("hex")` → a 64-character hex string.
2. The same value is hashed with `createHash("sha256").update(rawToken).digest("hex")`.
3. `mintQuoteApprovalToken` writes the **hash** into `approvalTokenHash`, sets `approvalTokenCreatedAt = now`, and explicitly sets `approvalTokenExpiresAt = null` (i.e. no expiration is currently configured at mint time).
4. The raw token is returned to the caller. The route then wraps it in `buildApprovalUrl(...)` and sends it to the client. The raw token is **never persisted**.

### How token hash is stored
- Only the SHA-256 hex digest is written to the database (`approvalTokenHash`).
- Re-minting overwrites the previous hash, invalidating the previous link.
- The schema includes `@@index([approvalTokenHash])` so public lookups are O(log n).

### How token validation works
Both `findQuoteByApprovalToken` and `recordQuoteApproval` perform the same checks:

1. Trim the raw token; reject empty.
2. Compute SHA-256 hash.
3. Query `Document` with `approvalTokenHash = hash AND type = QUOTE AND status = ISSUED`.
4. If not found → return `null` / throw `APPROVAL:Invalid token`.
5. If `approvalTokenExpiresAt < now` → return `null` / throw `APPROVAL:Invalid token`.
6. (Submission only) If `approvedAt` is set → throw `APPROVAL:Already approved`.

The route layer maps both "not found" and "expired" to a single 404 with `code: "INVALID"` and the Hebrew message `"קישור האישור אינו תקין או שאינו זמין"`. "Already approved" returns 409 with `code: "ALREADY_APPROVED"`.

### How approval submission works
`src/app/api/public/approve/[token]/route.ts`:

1. Parse JSON body with a Zod schema:
   - `approvedByName`: trimmed, length 2–120.
   - `termsAccepted`: optional `literal(true)`.
   - `signatureDataUrl`: optional, ≤ 300,000 chars, must match `/^data:image\/(?:png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/`.
2. Extract client IP from `x-forwarded-for` (first segment) or `x-real-ip`.
3. Read `user-agent` header.
4. Call `recordQuoteApproval(token, { approvedByName, approvalIp, approvalUserAgent, approvalSignatureDataUrl })`.
5. Inside a Prisma transaction, the service updates the `Document` setting `approvedAt = new Date()`, `approvedByName`, `approvalIp`, `approvalUserAgent` (sliced to 500 chars), `approvalSignatureDataUrl`, and `approvalTermsAccepted = true`.
6. After the transaction commits, the service tries (best-effort, in a try/catch) to create a Google Calendar event and to build a `wa.me` redirect URL for the business owner.
7. The route responds with `{ approvedAt, approvedByName, calendarEventCreated, whatsappRedirectUrl }`.

---

## 4. Security notes

- **Raw token is never stored.** `mintQuoteApprovalToken` only writes `approvalTokenHash`. The raw token only exists in the response body, the URL, and (when emailed) the email body.
- **Token hash is SHA-256 hex.** No additional pepper/HMAC. Token entropy is 256 bits (`randomBytes(32)`), which is sufficient even without peppering.
- **Token expiration behavior.** The schema supports `approvalTokenExpiresAt`, and both read paths honor it. **However, `mintQuoteApprovalToken` currently sets it to `null` on mint** (`src/services/document.service.ts:972`), so tokens issued today do not expire on their own. They are invalidated only by:
  - Re-minting (overwrites the hash).
  - The customer approving (sets `approvedAt`, after which submission is rejected as "already approved" and the page renders the read-only "approved" view).
  - Status changing away from `ISSUED` (the `status = ISSUED` filter on the lookup).
  *(Needs verification: whether this open-ended lifetime is intentional.)*
- **Public page access rules.** The public page (`/green/approve/[token]`, alias `/green/a/[token]`) and the submission API (`/api/public/approve/[token]`) require **only the token**. There is no rate limiting visible in the route file (Needs verification — there is no global rate limiter referenced from this code path).
- **Status / type guard.** Lookups always require `type = QUOTE AND status = ISSUED`. A draft, cancelled, deleted, or non-quote document cannot be approved.
- **Duplicate approval prevention.** `recordQuoteApproval` runs in a `db.$transaction` and re-checks `approvedAt` inside the transaction (`src/services/document.service.ts:1217-1219`). A second submission against the same hash returns 409 `ALREADY_APPROVED`. The page itself also short-circuits to the "approved" view when `doc.approvedAt` is set, hiding the form.
- **Mint-time guards.** `mintQuoteApprovalToken` refuses to mint if the document is not a QUOTE (400), is not `ISSUED` (400), or is already approved (409).
- **IP capture.** The route reads `x-forwarded-for` first (taking the leftmost segment) and falls back to `x-real-ip`. There is no validation that the upstream proxy is trusted; in deployments without a reverse proxy these headers can be spoofed by clients. *(Needs verification: trust boundary for these headers in production.)*
- **User-agent capture.** Read from the `user-agent` header and **truncated to 500 characters** before storage (`src/services/document.service.ts:1227`).
- **Signature input validation.** `signatureDataUrl` must be a base64 PNG/JPEG/JPG/WebP data URL and ≤ 300,000 characters. There is **no server-side decoding/validation** of the image bytes themselves, and the field is rendered later via `<img src={...}>` in the dashboard (`src/app/(dashboard)/documents/[id]/page.tsx:241-245`).
- **Error messages are intentionally vague.** Both "not found" and "expired" return the same Hebrew message and `code: "INVALID"` so an attacker cannot distinguish a wrong token from an expired one.
- **Logging.** `DocumentShareActions.tsx` and `delivery.ts` contain verbose `console.debug`/`console.log` lines that print rendered WhatsApp messages and final URLs (e.g. `console.log("FINAL_WHATSAPP_URL", shareUrl)`). These leak the customer-facing URL — which contains the raw approval token — to the **browser console** for the business owner. Anyone with access to the owner's browser devtools, browser-extension logs, or remote-debug tooling could capture the token. *(Risk: token exposure via client-side console.)*
- **Cross-tenant isolation on mint.** `mintQuoteApprovalToken` filters by both `id` and `businessId`, so an authenticated owner cannot mint a token for another business' document.
- **Calendar event creation runs only after the transaction commits.** It uses the in-memory raw token (which is included inside the calendar event description as a clickable link). This means the **owner's Google Calendar event description contains the raw approval token** — anyone who can view the event can approve the quote until it is approved.

---

## 5. Data model

All fields live on `Document` (`prisma/schema.prisma:217-233`).

| Field | Type | Set by | Meaning |
| --- | --- | --- | --- |
| `approvalTokenHash` | `String?` | `mintQuoteApprovalToken` | SHA-256 hex of the active raw token. Indexed. Re-minting overwrites. |
| `approvalTokenCreatedAt` | `DateTime?` | `mintQuoteApprovalToken` | Server-side mint timestamp. Informational only. |
| `approvalTokenExpiresAt` | `DateTime?` | Schema-supported, **currently always set to `null` on mint** | If non-null and in the past, both lookup and submission treat the token as invalid. |
| `approvedAt` | `DateTime?` | `recordQuoteApproval` | Set the moment the customer submits the form. Presence ⇒ "approved". |
| `approvedByName` | `String?` | `recordQuoteApproval` | Trimmed full name typed by the customer (Zod min 2 / max 120). |
| `approvalIp` | `String?` | `recordQuoteApproval` | First segment of `x-forwarded-for`, else `x-real-ip`. |
| `approvalUserAgent` | `String?` | `recordQuoteApproval` | Browser UA, sliced to 500 chars. |
| `approvalSignatureDataUrl` | `String?` `@db.Text` | `recordQuoteApproval` | base64 data URL (PNG/JPEG/JPG/WebP), ≤ 300,000 chars. Rendered in the owner dashboard. |
| `approvalTermsAccepted` | `Boolean` (default `false`) | `recordQuoteApproval` | Always written `true` when the form submission succeeds. The Zod schema marks `termsAccepted` optional, but the client form blocks submit until the checkbox is ticked, and the service unconditionally writes `true`. |
| `googleCalendarEventId` | `String?` | `tryCreateOwnerCalendarEvent` | Set after a successful Google Calendar insert. Used to make calendar creation idempotent across re-approvals. |

---

## 6. User-facing behavior

### What the business owner sees
- On `/green/documents/<id>` (issued QUOTE), the toolbar shows:
  - **שלח קישור אישור** — primary brown button. Renders only when `type === "QUOTE"`, `status === "ISSUED"`, and `approvedAt` is null. While in flight, the label changes to **שולח...** and the button is disabled.
  - **הורדת PDF** — secondary outline button to the public PDF.
- The "פרטי המסמך" card includes an **"אישור לקוח"** row showing either:
  - `אושרה על ידי <name> בתאריך <date>` (when `approvedByName` exists), or
  - `אושרה בתאריך <date>` (when only `approvedAt` exists), or
  - `ממתינה לאישור לקוח` (before approval).
- After approval, a **חתימת לקוח** thumbnail (`<img src={doc.approvalSignatureDataUrl}>`) is rendered below the notes.

### What the customer sees
On `/green/a/<token>` (or `/green/approve/<token>`):

- Header card with the business name, the quote number, the issue date, and contact line (`phone · email`).
- A status banner: green "הצעת המחיר אושרה" if already approved, otherwise an off-white "לפני האישור" prompt.
- A details panel ("פרטי הלקוח והאירוע") with tiles for customer name, email, phone, event date, event time, event location (only the populated ones).
- A button **צפייה / הורדת PDF** that opens the public PDF using a token from `createPublicPdfToken(doc.id, doc.issuedHash)` (separate token from the approval token).
- One section per quote item with title + bullet list parsed from `description`, plus a "סה"כ לחבילה" line.
- If the quote has terms text, a **QuoteTermsModal** opens the small print.
- The **ApprovalForm** at the bottom (only when not yet approved):
  1. **שם מלא** — text input, prefilled with the customer name from the document.
  2. **חתימה** — a `<canvas>` the customer draws on with finger or mouse; **נקה חתימה** clears it.
  3. **קראתי ואני מאשר/ת את פרטי ההצעה והתנאים** — required checkbox. A modal trigger to view terms is rendered next to it when terms exist.
  4. Submit button **מאשר/ת את הצעת המחיר** (disabled while loading; switches to **מאשר/ת...**).

### What happens after approval
1. The form `POST`s to `/api/public/approve/<token>` and receives `{ approvedAt, approvedByName, calendarEventCreated, whatsappRedirectUrl }`.
2. The form swaps to a green "APPROVED" success card showing **הצעת המחיר אושרה בהצלחה / התאריך נשמר עבורך**.
3. If `calendarEventCreated` is true, a chip reading **האירוע נוסף ליומן של פוטופ** is shown.
4. A **שלח לי בוואטסאפ** button is rendered. It opens a `wa.me` URL that the customer can use to send the owner a "approved" message; it is disabled and shows **(לא הוגדר מספר WhatsApp לעסק)** when the business has no phone.
5. If the API returned a `whatsappRedirectUrl` (i.e. the business has a phone), the page **immediately navigates** the customer to that URL via `window.location.href`. (This means the inline success card is briefly visible before the redirect.)
6. If the same link is opened again later, the page renders the read-only "approved" banner and hides the form.

### Error states
| Trigger | UI / response |
| --- | --- |
| Token does not match any QUOTE, or document is not `ISSUED`, or token has expired | Page renders **InvalidTokenView**: "לא נמצאה הצעת מחיר", "קישור האישור אינו תקין או שאינו זמין". Submission API: 404 `{ error: "קישור האישור אינו תקין או שאינו זמין", code: "INVALID" }`. |
| Empty token | `findQuoteByApprovalToken` returns `null` → InvalidTokenView. |
| Document has no `issuedHash` | InvalidTokenView (the page guards on `!doc.issuedHash`). |
| Document already approved | Page hides the form and shows the green banner. Submission API: 409 `{ error: "הצעת המחיר כבר אושרה", code: "ALREADY_APPROVED" }`. |
| Missing name | Form-side validation: "יש למלא שם מלא". |
| Terms checkbox not ticked | Form-side validation: "יש לאשר את פרטי ההצעה והתנאים". |
| No signature drawn | Form-side validation: "יש לחתום לפני אישור ההצעה". |
| Network failure during submit | "אירעה שגיאת רשת. יש לנסות שוב." |
| Server-side validation failure (Zod) | First Zod issue's message, e.g. "פורמט החתימה לא תקין" or "שם מלא ארוך מדי". HTTP 400. |
| Owner clicks **שלח קישור אישור** while QUOTE is not issued | API returns 400 `{ error: "ניתן להפיק קישור אישור רק להצעת מחיר שהונפקה" }`. |
| Owner clicks **שלח קישור אישור** when quote is already approved | API returns 409 `{ error: "הצעת המחיר כבר אושרה" }`. |
| Customer has no phone in DB | Front-end falls back to copying the URL to clipboard and toasting "אין מספר טלפון ללקוח, הקישור הועתק". |

---

## 7. Files touched / code map

### Database / schema
- `prisma/schema.prisma` — `Document` approval fields and `@@index([approvalTokenHash])` (lines 217-246).

### Server-side core
- `src/lib/documents/approval.ts` — token generation, hashing, URL builders.
- `src/services/document.service.ts` — `mintQuoteApprovalToken`, `findQuoteByApprovalToken`, `recordQuoteApproval`, `tryCreateOwnerCalendarEvent`, `buildOwnerApprovalWhatsappRedirectUrl` (lines 939-1306).
- `src/services/email.service.ts` — `sendDocumentEmail`; auto-mints an approval token for unapproved QUOTEs and embeds the link in the email body (lines 104-120).
- `src/services/google-calendar.service.ts` — `createCalendarEventForBusiness` used by `tryCreateOwnerCalendarEvent`.

### API routes
- `src/app/api/documents/[id]/approval-link/route.ts` — owner-only mint endpoint behind `requireBusiness()`.
- `src/app/api/documents/[id]/issue/route.ts` — issues a draft and (for QUOTEs) mints + emails the approval link.
- `src/app/api/documents/[id]/send/route.ts` — re-sends the issued-document email (which mints a token if needed).
- `src/app/api/public/approve/[token]/route.ts` — public submission endpoint with Zod validation and IP/UA capture.

### Public-facing pages
- `src/app/approve/[token]/page.tsx` — server-rendered approval page (`force-dynamic`).
- `src/app/approve/[token]/ApprovalForm.tsx` — client component with the canvas signature, name input, terms checkbox, submit handler, and the post-approval WhatsApp redirect.
- `src/app/approve/[token]/QuoteTermsModal.tsx` — modal that displays `quoteTermsText`.
- `src/app/a/[token]/page.tsx` — short alias that re-exports the above.

### Owner-facing UI
- `src/app/(dashboard)/documents/[id]/page.tsx` — wires `DocumentShareActions` and renders the `אישור לקוח` row + signature thumbnail.
- `src/components/documents/DocumentShareActions.tsx` — the **שלח קישור אישור** button and WhatsApp share flow.
- `src/app/(dashboard)/settings/page.tsx` and `src/app/(dashboard)/settings/BusinessSettingsForm.tsx` — UI for editing `approvalWhatsappMessageTemplate`.
- `src/app/api/business/route.ts` and `src/services/business.service.ts` — persistence for `approvalWhatsappMessageTemplate`.
- `src/lib/validations/business.ts` — Zod schema for the business settings form (includes the template field).

### Shared helpers
- `src/lib/documents/delivery.ts` — `buildApprovalShareMessage`, `buildApprovedQuoteOwnerWhatsappMessage`, `buildOwnerApprovalRedirectWhatsappMessage`, `buildWhatsappShareUrl`, `normalizeWhatsappPhone`, and `DEFAULT_APPROVAL_WHATSAPP_MESSAGE_TEMPLATE`.
- `src/lib/documents/public-pdf.ts` — separate `createPublicPdfToken` used for the PDF link rendered on the public approval page (not part of the approval token system itself).
- `src/lib/api-base.ts` — `API_BASE` used by both the client button and the approval form.

### Tests
- `src/services/email.service.test.ts` — references `approvalRawToken` flows in the email service.
- `src/lib/documents/delivery.test.ts` — covers delivery helpers (template rendering, WhatsApp URL building).
  *(Needs verification: there appear to be no dedicated tests for `mintQuoteApprovalToken`, `findQuoteByApprovalToken`, or `recordQuoteApproval`.)*

---

## Gaps and items marked "Needs verification"
- `approvalTokenExpiresAt` is wired through schema and lookups but is set to `null` at mint time. Confirm whether tokens are intended to live forever until re-minted or approved.
- The public submission route has no visible rate limiting. Confirm whether a global limiter (middleware, edge, or proxy) protects this endpoint in production.
- IP capture trusts `x-forwarded-for` and `x-real-ip` without a documented trusted-proxy boundary.
- The signature data URL is validated by regex/length only — no server-side image decoding. The signature is then rendered with `<img>` in the owner dashboard.
- Verbose client-side `console.log`/`console.debug` lines in `DocumentShareActions.tsx` and `delivery.ts` print the rendered WhatsApp message and the final share URL (which embeds the raw approval token).
- The Google Calendar event description embeds the raw approval URL/token — anyone with calendar access can approve the quote until it is approved.
- No dedicated unit tests appear to cover `mintQuoteApprovalToken`, `findQuoteByApprovalToken`, or `recordQuoteApproval`.
