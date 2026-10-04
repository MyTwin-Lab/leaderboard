# Booking

> `/book`: a one-to-one call with Rubens, booked in two steps — first name and email on the Lab, recorded in the MyTwin CRM under the source of the call that led there, then the slot on Calendly, where they arrive pre-filled.

**Requires:** `MYTWIN_BACKEND_GRAPHQL_URL` (the MyTwinOS GraphQL endpoint). No database, no Calendly API. The Calendly account is on the **free plan** (one event type, no webhooks).

## The flow

1. A visitor clicks one of the Lab's four booking calls. Each carries an **intent**:

   | Call | Where | Intent (`?for=`) | CRM source | Contact type |
   |---|---|---|---|---|
   | **Create Your Twin** | home, last section | `twin-creation` | `lab_twin_creation` | `patient` |
   | **Create your sandbox** | the night strip at the bottom of `/challenges`, `/leaderboard`, `/sandbox` | `sandbox-project` | `lab_sandbox_project` | `startup` |
   | **Build the benchmark with us** | `/benchmark`, hero | `benchmark-submission` | `lab_benchmark_submission` | `startup` |
   | **Build the benchmark with us** | `/benchmark`, Contribute section | `scientific-committee` | `lab_scientific_committee` | `expert` |
   | — | `/book` with no or an unknown `?for=` | — | `lab_general` | `patient` |

2. `/book` asks for a first name and an email. **Choose a time** calls the server action `startBooking` (`app/book/actions.ts`), which:
   - validates the two fields again, and re-reads the intent against the closed list — it comes from the client;
   - calls `crmSubmitBookingRequest` on MyTwinOS (kind `booking`, the intent's source, the `utm_*` below), which answers with the **submission uuid**;
   - returns the Calendly URL, that the form opens in the same tab.
3. Calendly (`https://calendly.com/rubens-mytwin/30min`) receives:

   | Param | Value |
   |---|---|
   | `name`, `email` | what was typed — Calendly pre-fills *Enter Details* with them |
   | `utm_source` | `mytwinlab.care` |
   | `utm_medium` | `booking-page` |
   | `utm_campaign` | the intent, or `general` |
   | `utm_content` | the CRM submission uuid — absent if the CRM could not be reached |

4. The visitor picks a slot; Calendly stores the booking **with its UTM parameters**, sends the confirmation and the Google Meet link. The CRM sends nothing on a `booking`.

**One identifier per intent, end to end.** The intent is the `?for=`, the `utm_campaign` and — prefixed `lab_`, in snake case — the CRM source. The CRM submission and the Calendly booking share `utm_content`: that is how the webhook, once it exists, will mark the exact submission as booked.

## Where things live

- `apps/leaderboard-client/src/lib/booking.ts` — `BOOKING_PATH`, the Calendly URL, the intents and their CRM sources, `bookingPath()`, `bookingUtm()`, `calendlyBookingUrl()`. Pure; tested in `booking.test.ts`.
- `apps/leaderboard-client/src/lib/server/crm.ts` — `submitBookingRequest()`, the only call to the CRM. Tested in `crm.test.ts`.
- `apps/leaderboard-client/src/app/book/` — the page and its copy per intent, `actions.ts` (the server action, tested in `actions.test.ts`).
- `apps/leaderboard-client/src/components/booking/` — `BookingForm.tsx` (client) and `booking-vitrine.css`.
- The four calls: `components/home/HomeCreateTwin.tsx`, `components/vitrine/CreateSandboxStrip.tsx`, `components/benchmark/BenchmarkVitrine.tsx` (two).
- On the backend: `MyTwinOS/docs/api/crm.md`, section *Prise de rendez-vous du Lab*. The admin labels of the `lab_*` sources, the `booking` kind and the `expert` type live in `mytwin-health-landing` (`lib/admin-status.ts`, `features/admin-contacts/data/`).

## Decisions

- **The CRM never blocks a booking.** `submitBookingRequest` never throws: no endpoint configured, a timeout (5 s), an HTTP or GraphQL error all return `null`, are logged as `[crm:booking]`, and the visitor still goes to Calendly — without `utm_content`. A lost CRM row can be found again from Calendly's UTMs; a lost booking cannot.
- **Two calls on `/benchmark`, two sources.** Submitting a twin and joining the committee that reviews them are two audiences: a builder (`startup`) and a researcher or clinician (`expert`).
- **A honeypot, not a captcha.** The form carries a `website` field, off-screen and out of the tab order. Filled, the request skips the CRM but the answer is the same — a bot learns nothing. The CRM mutation is public, like every `crmSubmit*`.
- **A redirect, not an embedded iframe.** The Calendly widget sets its own cookies and shows its own consent banner; the Lab has none and promises none (privacy policy §9). Nothing on `/book` calls a third party until the visitor clicks.
- **`noindex, follow`, out of the sitemap.** A conversion page, not content ([`seo.md`](./seo.md)).
- **"Create your sandbox" books a call for everyone**, signed in or not. Contributors no longer create a sandbox themselves from the listing; the creation modal stays mounted only on a sandbox's detail page, for editing. See the TODO below for the admin side.
- **Back-button safe.** Returning from Calendly restores the page from the bfcache; `pageshow` resets the button from "Opening Calendly…".

## Gotchas

- **Former intents are gone.** `?for=twin` and `?for=project` now open the general page (source `lab_general`). No CRM request had been made with them.
- **An intent is declared in four places**: `BOOKING_INTENTS` and `CRM_SOURCE_BY_INTENT` (`lib/booking.ts`), the page copy (`app/book/page.tsx`), and — for a new source — the `CrmSource` enum of MyTwinOS (Prisma + migration, `CRM_SOURCES`, `TYPE_BY_SOURCE`, SDL, the `@IsIn` of `SubmitCrmBookingRequestInput`) and the admin labels.
- The event type is the only one the free plan allows. Changing its slug (`30min`) breaks the link: update `CALENDLY_EVENT_URL`.
- Calendly pre-fills only the fields it knows: `name` and `email`. If the event is switched to separate first/last name fields, the params become `first_name` / `last_name`.

---

## TODO — next session

### 1. Calendly webhook (Rubens, then MyTwinOS)

- [ ] Upgrade to **Standard** — required for webhooks. The API (read) already works on the free plan.
- [ ] Create a **personal access token** (Integrations → API & Webhooks) for the backfill and the webhook subscription.
- [ ] `POST /webhooks/calendly` in MyTwinOS (REST, raw body, signature check like `resend-webhook.controller.ts`): `invitee.created` → find the submission by `tracking.utm_content` and mark it booked; `invitee.canceled` → mark it canceled. Idempotent on the invitee URI (Calendly retries).
- [ ] **Backfill** the bookings made before the webhook, through the API (`GET /scheduled_events` + invitees).
- [ ] Optional: add an invitee question *"Who is the twin for? Yourself / your patients / your employees"* — it would let a `lab_twin_creation` booking set the contact type.
- [ ] Optional: rename the event — "MyTwin Lab" reads oddly for someone coming to create their twin.
- [ ] Look at **Notetaker** once the webhook exists (meeting notes attached to the contact).

### 2. Privacy policy

- [ ] `content/legal/privacy-policy.md`: the booking form now sends the first name and email to the MyTwin CRM. Add a "Booking a call" processing in §4 (data, purpose, basis, retention — 3 years after the last contact is the CNIL norm for prospects), Calendly (United States, EU-U.S. DPF) in §8, and mention in §9 that the booking page itself loads nothing from Calendly.

### 3. Lab (this repo)

- [ ] **Admin sandbox creation.** The admin UI has no sandbox creation screen, and the listing no longer offers one. `POST /api/sandboxes` still accepts creator roles, so an admin UI (or re-opening the modal to admins on `/sandbox`) is only a front-end change.
- [ ] Optional: tell which call site converts (home, challenges, leaderboard, sandbox). `utm_content` is taken by the submission uuid: use `utm_term`, on both the CRM and the Calendly side.

### 4. Cookies and consent audit (Lab + Health Landing)

Lab: no tracker, strictly necessary cookies only, YouTube click-to-load — consistent with its policy. Health Landing (`../mytwin-health-landing`), found during this session:
- [ ] Contact and demo-request forms: no privacy notice, no link to the policy (what the GDPR requires there is **information**, not consent).
- [ ] Waiting list: implied consent only, no consent record sent; the email travels in the `/welcome` query string.
- [ ] The privacy policy covers the app, not the site: no cookie section, no mention of the forms, the CRM, YouTube or flagcdn.
- [ ] `flagcdn.com` flags are loaded straight from the visitor's browser (IP to a third party) — self-host them.
- [ ] No legal notice (mentions légales) page; no security headers / CSP.
- [ ] `waiting-list/lib/graphql.ts` falls back to the **production** backend when `MYTWIN_BACKEND_GRAPHQL_URL` is unset.

Related: [`sandbox.md`](./sandbox.md) · [`seo.md`](./seo.md) · [`index.md`](./index.md)
