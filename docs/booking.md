# Booking

> `/book`: a one-to-one call with Rubens, booked in two steps — first name and email on the Lab, recorded in the MyTwin CRM under the source of the call that led there, then the slot on Lemcal, where they arrive pre-filled.

**Requires:** `MYTWIN_BACKEND_GRAPHQL_URL` (the MyTwinOS GraphQL endpoint). No database, no Lemcal API on the Lab side. Lemcal has no free plan: a 14-day trial, then a single paid plan, with the API and the hooks. One meeting type, `30min`, for every intent.

## The flow

1. A visitor clicks one of the Lab's four booking calls. Each carries an **intent**:

   | Call | Where | Intent (`?for=`) | CRM source | Contact type |
   |---|---|---|---|---|
   | **Create Your Twin** | home, last section | `twin-creation` | `lab_twin_creation` | `patient` |
   | **Create your sandbox** | the night strip at the bottom of `/challenges`, `/leaderboard`, `/sandbox` | `sandbox-project` | `lab_sandbox_project` | `startup` |
   | **Build the benchmark with us** | `/benchmark`, hero and Contribute section | `scientific-committee` | `lab_scientific_committee` | `expert` |
   | — | `/book` with no or an unknown `?for=` | — | `lab_general` | `patient` |

   Calls that are not on the home also carry an **origin** (`?from=`): `benchmark`, or the page showing the sandbox strip (`challenges`, `leaderboard`, `sandbox`). It only sets where `/book`'s back link leads ("Back to the benchmark"…); without it, the link goes back to the Lab's home.

2. `/book` asks for a first name and an email. **Choose a time** calls the server action `startBooking` (`app/book/actions.ts`), which:
   - validates the two fields again, and re-reads the intent against the closed list — it comes from the client;
   - calls `crmSubmitBookingRequest` on MyTwinOS (kind `booking`, the intent's source, the `utm_*` below), which answers with the **submission uuid**;
   - returns the Lemcal URL, that the form opens in the same tab.
3. Lemcal (`https://app.lemcal.com/@mytwinlab/30min`) receives one param, `guestInfos`: a JSON object `{"name": <first name>, "email": <email>}`, as typed. Lemcal pre-fills its booking form with it, and carries it from the slot step to the details step.

   The CRM request carries the `utm_*` (`utm_source` = `mytwinlab.care`, `utm_medium` = `booking-page`, `utm_campaign` = the intent, or `general`). Lemcal gets none: its booking page ignores them and a meeting stores none.

4. The visitor picks a slot; Lemcal stores the meeting with the name and email, sends the confirmation and the video link. The CRM sends nothing on a `booking`.

**One identifier per intent, end to end.** The intent is the `?for=`, the `utm_campaign` and — prefixed `lab_`, in snake case — the CRM source. The CRM submission and the Lemcal meeting share the **email**: that is how the webhook, once it exists, will find the submission to mark as booked.

## Where things live

- `apps/leaderboard-client/src/lib/booking.ts` — `BOOKING_PATH`, the Lemcal URL, the intents and their CRM sources, the origins (`BOOKING_ORIGINS`), `bookingPath()`, `bookingUtm()`, `lemcalBookingUrl()`. Pure; tested in `booking.test.ts`.
- `apps/leaderboard-client/src/lib/server/crm.ts` — `submitBookingRequest()`, the only call to the CRM. Tested in `crm.test.ts`.
- `apps/leaderboard-client/src/app/book/` — the page and its copy per intent, `actions.ts` (the server action, tested in `actions.test.ts`).
- `apps/leaderboard-client/src/components/booking/` — `BookingForm.tsx` (client) and `booking-vitrine.css`.
- The four calls: `components/home/HomeCreateTwin.tsx`, `components/vitrine/CreateSandboxStrip.tsx`, `components/benchmark/BenchmarkVitrine.tsx` (two).
- On the backend: `MyTwinOS/docs/api/crm.md`, section *Prise de rendez-vous du Lab*. The admin labels of the `lab_*` sources, the `booking` kind and the `expert` type live in `mytwin-health-landing` (`lib/admin-status.ts`, `features/admin-contacts/data/`).

## Decisions

- **The CRM never blocks a booking.** `submitBookingRequest` never throws: no endpoint configured, a timeout (5 s), an HTTP or GraphQL error all return `null`, are logged as `[crm:booking]`, and the visitor still goes to Lemcal. A lost CRM row can be found again from the Lemcal meeting (name, email); a lost booking cannot.
- **Two calls on `/benchmark`, one source.** The page speaks to a single audience: the expert (researcher, clinician, builder) who wants to help improve the open-source benchmark. There is no twin submission; a `lab_benchmark_submission` source existed for a few days and was folded into `lab_scientific_committee` (MyTwinOS migration `20261006120000_drop_crm_lab_benchmark_submission`).
- **One page, intent and origin kept apart.** The `/book` variants differ only by their lede and their back link, so they stay one page. The intent says *why* someone books (lede, CRM source, `utm_campaign`); the origin says *where from* (back link only). They cannot be merged: the sandbox strip is one intent on three pages. `?from=` is read against the closed `BOOKING_ORIGINS` list, never as a URL, so an outside link cannot pick the back link's target. Not `history.back()`: it breaks on a direct visit or a new tab.
- **A honeypot, not a captcha.** The form carries a `website` field, off-screen and out of the tab order. Filled, the request skips the CRM but the answer is the same — a bot learns nothing. The CRM mutation is public, like every `crmSubmit*`.
- **A redirect, not an embedded iframe.** The Lemcal page loads its own third-party scripts (analytics, widgets); the Lab has none and promises none (privacy policy §9). Nothing on `/book` calls a third party until the visitor clicks.
- **`noindex, follow`, out of the sitemap.** A conversion page, not content ([`seo.md`](./seo.md)).
- **"Create your sandbox" books a call for everyone**, signed in or not. Contributors no longer create a sandbox themselves from the listing; the creation modal stays mounted only on a sandbox's detail page, for editing. See the TODO below for the admin side.
- **Back-button safe.** Returning from Lemcal restores the page from the bfcache; `pageshow` resets the button from "Opening the calendar…" — a label that names no tool, so the next switch leaves the copy alone.
- **Matched by email, not by an id in the URL.** Lemcal reads no `utm_*` and has no hidden field: its custom questions (`surveyAnswers`) are shown to the visitor, and `leadId` is a lemlist lead. The email is pre-filled, so the meeting almost always carries the one the CRM has.

## Gotchas

- **Former intents are gone.** `?for=twin` and `?for=project` now open the general page (source `lab_general`). No CRM request had been made with them. `?for=benchmark-submission` does too; its CRM requests were moved to `lab_scientific_committee`.
- **An intent is declared in four places**: `BOOKING_INTENTS` and `CRM_SOURCE_BY_INTENT` (`lib/booking.ts`), the page copy (`app/book/page.tsx`), and — for a new source — the `CrmSource` enum of MyTwinOS (Prisma + migration, `CRM_SOURCES`, `TYPE_BY_SOURCE`, SDL, the `@IsIn` of `SubmitCrmBookingRequestInput`) and the admin labels.
- Changing the meeting type's link (`30min`) or the public identifier (`@mytwinlab`) breaks the URL: update `LEMCAL_MEETING_URL`.
- `guestInfos` is not documented by Lemcal: it was read from their booking page's code, and checked by hand on 2026-10-08. If the form stops arriving pre-filled, look there first. Nothing breaks but the pre-fill.
- The visitor can change the email on Lemcal. The meeting then matches no submission: the webhook must keep it, unmatched, rather than drop it.

---

## TODO — next session

### 1. Lemcal meetings in the CRM (MyTwinOS)

Live since 2026-10-09: `CrmMeeting`, `POST /webhooks/lemcal?token=…` (a signal only: it triggers a full sync from `GET /api/lemcal/meetings`), the admin mutation `syncCrmMeetings` and the field `CrmContact.meetings`. See `MyTwinOS/docs/api/crm.md`, *Les meetings Lemcal*. The hook is set in Lemcal → Integrations → Webhooks (all meeting types); it fires on **new** bookings only, so a cancellation reaches the CRM at the next sync.

- [x] `LEMCAL_USER_ID` (the `usr_…` shown as the Zapier username), `LEMCAL_API_KEY`, `LEMCAL_WEBHOOK_SECRET` on `mytwin-backend`.
- [x] Hook subscribed, test booking recorded and matched to its contact and `booking` submission.
- [x] Guest mapping checked on a real meeting: no `lead` on a public booking, the guest is the `primary` attendee (MyTwinOS `79fa472`).
- [ ] Cancel a booking, run `syncCrmMeetings`, check `canceledAt` — the field is not documented.
- [ ] Show the meetings on the contact page of the admin (`mytwin-health-landing`).

### 2. Lemcal PRO

The booking page redirects to the Lab's home after a booking (*Confirmation redirect URL* on the meeting type, set by hand in Lemcal).

- [ ] Move to the **PRO** plan.
- [ ] **One meeting type per intent** (twin creation, sandbox, scientific committee, general): `LEMCAL_MEETING_URL` becomes one URL per intent in `lib/booking.ts`, and the meeting's `meetingTypeId` tells the intent without the email match.
- [ ] Optional: redirect to a `/book/booked` page that leads back to the page of the call (origin kept in `sessionStorage` before leaving), instead of the home.
- [ ] Optional: add a booking question *"Who is the twin for? Yourself / your patients / your employees"* — it would let a `lab_twin_creation` booking set the contact type.

### 3. Privacy policy

- [ ] `content/legal/privacy-policy.md`: the booking form now sends the first name and email to the MyTwin CRM. Add a "Booking a call" processing in §4 (data, purpose, basis, retention — 3 years after the last contact is the CNIL norm for prospects), Lemcal (lemlist — check where the data is hosted and sign their DPA) in §8, and mention in §9 that the booking page itself loads nothing from Lemcal.

### 4. Lab (this repo)

- [ ] **Admin sandbox creation.** The admin UI has no sandbox creation screen, and the listing no longer offers one. `POST /api/sandboxes` still accepts creator roles, so an admin UI (or re-opening the modal to admins on `/sandbox`) is only a front-end change.
- [ ] Optional: tell which call site converts (home, challenges, leaderboard, sandbox). Lemcal keeps no UTM, so it is CRM-side only: send the origin as `utm_content` with the request.

### 5. Cookies and consent audit (Lab + Health Landing)

Lab: no tracker, strictly necessary cookies only, YouTube click-to-load — consistent with its policy. Health Landing (`../mytwin-health-landing`), found during this session:
- [ ] Contact and demo-request forms: no privacy notice, no link to the policy (what the GDPR requires there is **information**, not consent).
- [ ] Waiting list: implied consent only, no consent record sent; the email travels in the `/welcome` query string.
- [ ] The privacy policy covers the app, not the site: no cookie section, no mention of the forms, the CRM, YouTube or flagcdn.
- [ ] `flagcdn.com` flags are loaded straight from the visitor's browser (IP to a third party) — self-host them.
- [ ] No legal notice (mentions légales) page; no security headers / CSP.
- [ ] `waiting-list/lib/graphql.ts` falls back to the **production** backend when `MYTWIN_BACKEND_GRAPHQL_URL` is unset.

Related: [`sandbox.md`](./sandbox.md) · [`seo.md`](./seo.md) · [`index.md`](./index.md)
