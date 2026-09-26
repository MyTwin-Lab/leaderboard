# Booking

> `/book`: a one-to-one call with Rubens, booked in two steps — first name and email on the Lab, then the slot on Calendly, where they arrive pre-filled.

**Requires:** nothing — no env var, no database, no Calendly API. The Calendly account is on the **free plan** (one event type, no webhooks).

## The flow

1. A visitor clicks one of the Lab's two booking calls:
   - **Create Your Twin** (home, last section) → `/book?for=twin`
   - **Create your sandbox** (the night strip at the bottom of `/challenges`, `/leaderboard`, `/sandbox`) → `/book?for=project`
2. `/book` asks for a first name and an email. **Choose a time** opens `https://calendly.com/rubens-mytwin/30min` in the same tab, with:

   | Param | Value |
   |---|---|
   | `name`, `email` | what was typed — Calendly pre-fills *Enter Details* with them |
   | `utm_source` | `mytwinlab.care` |
   | `utm_medium` | `booking-page` |
   | `utm_campaign` | `create-your-twin` · `sandbox-project` · `general` (no or unknown `?for=`) |

3. The visitor picks a slot; Calendly stores the booking **with its UTM parameters**, sends the confirmation and the Google Meet link.

**The Lab stores nothing.** The form posts nowhere: the two fields only travel in the Calendly URL. The UTMs are how a booking is later attributed (twin vs. Sandbox project) when it is pulled into the CRM.

## Where things live

- `apps/leaderboard-client/src/lib/booking.ts` — `BOOKING_PATH`, the Calendly URL, the intents, `bookingPath()`, `calendlyBookingUrl()`. Pure; tested in `booking.test.ts`.
- `apps/leaderboard-client/src/app/book/page.tsx` — the page and its copy per intent.
- `apps/leaderboard-client/src/components/booking/` — `BookingForm.tsx` (client) and `booking-vitrine.css`.
- The two calls: `components/home/HomeCreateTwin.tsx`, `components/vitrine/CreateSandboxStrip.tsx`.

## Decisions

- **A redirect, not an embedded iframe.** The Calendly widget sets its own cookies and shows its own consent banner; the Lab has none and promises none (privacy policy §9). Nothing on `/book` calls a third party until the visitor clicks.
- **`noindex, follow`, out of the sitemap.** A conversion page, not content ([`seo.md`](./seo.md)).
- **"Create your sandbox" books a call for everyone**, signed in or not. Contributors no longer create a sandbox themselves from the listing; the creation modal stays mounted only on a sandbox's detail page, for editing. See the TODO below for the admin side.
- **Back-button safe.** Returning from Calendly restores the page from the bfcache; `pageshow` resets the button from "Opening Calendly…".

## Gotchas

- The event type is the only one the free plan allows. Changing its slug (`30min`) breaks the link: update `CALENDLY_EVENT_URL`.
- Calendly pre-fills only the fields it knows: `name` and `email`. If the event is switched to separate first/last name fields, the params become `first_name` / `last_name`.

---

## TODO — next session

Ordered by what unblocks what. Tonight's version is deliberately the minimal, working slice.

### 1. Calendly account (Rubens)

- [ ] Upgrade to **Standard** — required for webhooks. The API (read) already works on the free plan.
- [ ] Create a **personal access token** (Integrations → API & Webhooks) for the backfill and the webhook subscription.
- [ ] Optional: add an invitee question *"Who is the twin for? Yourself / your patients / your employees"* — it decides the CRM contact type for `twin` bookings (see §2).
- [ ] Optional: rename the event — "MyTwin Lab" reads oddly for someone coming to create their twin.
- [ ] Look at **Notetaker** once the CRM link exists (meeting notes attached to the contact).

### 2. MyTwin CRM (`../MyTwinOS`, `packages/crm`)

Open decisions first:
- [ ] **Source value.** Proposal: one new `CrmSource`, `lab_landing` ("MyTwin Lab Landing — mytwinlab.care"), the intent (`twin` / `project`) carried in the submission payload and `utm_campaign`. To weigh against the existing `startups` source ("site MyTwin Lab — candidature builder", `crmSubmitStartupApplication`): is a Sandbox project owner a startup application?
- [ ] **Contact type.** `TYPE_BY_SOURCE` maps each source to one type. `project` → `startup` is natural; `twin` can be a patient, a clinician or an employer — default + admin correction, or the Calendly question above.

Then:
- [ ] Add the source in the 4 aligned places: Prisma `enum CrmSource` + migration (`ALTER TYPE … ADD VALUE`), `CRM_SOURCES` (`crm-contact.entity.ts`), `TYPE_BY_SOURCE` (`reconciliation.ts`), SDL (`crm.graphql`).
- [ ] New `CrmSubmissionKind` `booking`; **no email funnel** on it — Calendly already sends the confirmation.
- [ ] `POST /webhooks/calendly` (REST, raw body, signature check like `resend-webhook.controller.ts`): `invitee.created` → ingest; `invitee.canceled` → mark the submission. Intent from `tracking.utm_campaign`. Idempotent on the invitee URI (Calendly retries).
- [ ] **Backfill** the bookings made before the webhook, through the API (`GET /scheduled_events` + invitees), same idempotency key.
- [ ] Admin CRM labels (in `../mytwin-health-landing`: `admin-contacts/data/schemas.ts`, `lib/admin-status.ts`).
- [ ] `docs/api/crm.md` (enums, new endpoint). The Lab ↔ CRM work planned in `docs/temp/crm-backend-implementation.md` §8.6 (`CrmIngestKeyGuard`, `x-crm-ingest-key`, `crmSubmitContributor`) is the same chantier for contributors — do it in the same pass or explicitly later.
- [ ] Optional: also capture visitors who fill `/book` **but never book** — a Lab server action posting to the CRM before the redirect. It changes "the Lab stores nothing": privacy policy first.

### 3. Lab (this repo)

- [ ] **Admin sandbox creation.** The admin UI has no sandbox creation screen, and the listing no longer offers one. `POST /api/sandboxes` still accepts creator roles, so an admin UI (or re-opening the modal to admins on `/sandbox`) is only a front-end change.
- [ ] **Privacy policy** (`content/legal/privacy-policy.md`): add Calendly (United States, EU-U.S. DPF) to §8 and a "Booking a call" processing in §4 (data, purpose, basis, retention — 3 years after the last contact is the CNIL norm for prospects); mention in §9 that the booking page itself loads nothing from Calendly.
- [ ] Optional: `utm_content` per call site (home, challenges, leaderboard, sandbox) to know which strip converts.

### 4. Cookies and consent audit (Lab + Health Landing)

Lab: no tracker, strictly necessary cookies only, YouTube click-to-load — consistent with its policy. Health Landing (`../mytwin-health-landing`), found during this session:
- [ ] Contact and demo-request forms: no privacy notice, no link to the policy (what the GDPR requires there is **information**, not consent).
- [ ] Waiting list: implied consent only, no consent record sent; the email travels in the `/welcome` query string.
- [ ] The privacy policy covers the app, not the site: no cookie section, no mention of the forms, the CRM, YouTube or flagcdn.
- [ ] `flagcdn.com` flags are loaded straight from the visitor's browser (IP to a third party) — self-host them.
- [ ] No legal notice (mentions légales) page; no security headers / CSP.
- [ ] `waiting-list/lib/graphql.ts` falls back to the **production** backend when `MYTWIN_BACKEND_GRAPHQL_URL` is unset.

Related: [`sandbox.md`](./sandbox.md) · [`seo.md`](./seo.md) · [`index.md`](./index.md)
