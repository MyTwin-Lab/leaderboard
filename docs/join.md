# Join the Lab

> `/join`: an email (and, optionally, who you are) into the MyTwin CRM as a member of the Lab, then a welcome page. No account: the login wall only comes when someone takes part in a challenge.

**Requires:** `MYTWIN_BACKEND_GRAPHQL_URL` (the MyTwinOS GraphQL endpoint) and `JWT_SECRET` (already set: it signs the member cookie). No database on the Lab side.

## The flow

1. **Two calls lead here**, both labelled *Join the Lab*: the home's *Join our community* section (`HomeCommunity.tsx`) and the closing strip of `/vision` (`VisionVitrine.tsx`). A third comes from outside: the *Join the MyTwin Lab* button of the MyTwin Health waiting-list email (MyTwinOS migration `20261009120200_waitlist_email_links_to_lab_join`; it led to the WhatsApp group before).
2. **`/join`** — the title and the form card, alone, in one centred column — asks for an email and, optionally, a role: *Patient or caregiver*, *Clinician*, *Researcher*, *Developer*, *Other*. The button turns active as soon as there is an email; nothing ticked is sent as `other`. A consent line sits under the button. **Join the Lab** calls the server action `joinLab` (`app/join/actions.ts`), which:
   - validates the email again, and re-reads the role against the closed list;
   - calls `crmSubmitLabJoin` on MyTwinOS (source and kind `lab_join`, the role, `JOIN_CONSENT_VERSION`, the `utm_*`), which answers with `isFirstOfKind`;
   - sets the **member cookie** — and the form opens `/join/welcome`, or `/join/welcome?back=1` for an email already on the list.
3. MyTwinOS turns the role into a contact type (`researcher` → `expert`, `developer` → `contributor`, `other` → `unknown`) and sends `lab_join_confirmation`, in English, to a first-time member only. See `MyTwinOS/docs/api/crm.md`, *Rejoindre le Lab*.
4. **`/join/welcome`** welcomes the member: the mission, a note that the welcome email is on its way (with the spam-folder advice) — or, for a returning member, that their address was already on the list — then *Everyone has a place in the Lab*: examples of what members do, by audience. Text, not calls: the page has no button but *Back to the Lab*.

## The member cookie

`lab_member` (`lib/server/labMember.ts`): an HS256 JWT signed with the session secret — like `sb_anon` —, audience `lab-member`, one year, `httpOnly`. It carries the **email**, that the welcome page recalls.

- **The email never travels in a URL**: in a query string it would sit in the history, the server logs and the `Referer` header.
- **Signed**, so that a welcome page only opens for the browser that joined.
- **No cookie, a bad signature or an expired token**: `/join/welcome` redirects to `/join`.
- Joining again overwrites the cookie with the last email given. Older cookies also carry the steps of the former welcome page; they are ignored.

## Where things live

- `apps/leaderboard-client/src/lib/join.ts` — the paths, the roles (`LAB_ROLES`, `parseLabRole`), the consent version, the `utm_*`. Pure; tested in `join.test.ts`.
- `apps/leaderboard-client/src/lib/server/labMember.ts` — reading and writing the member cookie.
- `apps/leaderboard-client/src/lib/server/crm.ts` — `submitLabJoin()`, next to `submitBookingRequest()`. Tested in `crm.test.ts`.
- `apps/leaderboard-client/src/app/join/` — the two pages, and `actions.ts` (`joinLab`, tested in `actions.test.ts`).
- `apps/leaderboard-client/src/components/join/` — `JoinForm` (client) and `join-vitrine.css`. `/join` reuses the card and fields of `/book` (`booking-vitrine.css`).
- On the backend: `MyTwinOS/docs/api/crm.md` (*Rejoindre le Lab*), the funnel `onLabJoin` and the email `lab_join_confirmation` (`docs/api/crm-side-effects.md`, `docs/api/emails.md`). The admin labels (*Lab · Community*, *Unknown*, *Joined the MyTwin Lab*) live in `mytwin-health-landing` (`lib/admin-status.ts`, `features/admin-contacts/data/`).

## Decisions

- **Being a member is a source, not a type.** A contact has one type but accumulates sources: the admin filter `source = lab_join` lists every member, clinicians and startups included. A `lab_member` type would have overwritten a clinician's type.
- **`unknown`, not `patient`, is the weak type.** Introduced with this page: a member who answers *Other* is not a patient. `website`, `lab_general` and `lab_twin_creation` moved to `unknown` too, and the existing records they explain were backfilled. Types now have a rank (`unknown` < `patient` < professional types): a record only moves up.
- **The role is asked on `/join`, not on the welcome page.** One submission, one write. Asking it afterwards would need a second public write able to change an existing record.
- **The CRM never blocks joining.** No answer from the CRM: the visitor is welcomed anyway, as a new member.
- **No health story, no WhatsApp on the Lab** (2026-10-10). The welcome page had three first steps — share a health story (`/join/share`), join the WhatsApp community, explore the challenges — and the welcome email the same three calls. The story is now only collected by the MyTwin Health waiting list (`/welcome` on mytwin.care); the WhatsApp community is not offered anywhere; the email keeps *Explore the challenges* alone. No story had been filed from the Lab: nothing to migrate.
- **A honeypot, not a captcha**, as on `/book`. Filled: nothing reaches the CRM, no cookie, same answer.
- **`noindex, follow`, out of the sitemap**, both pages ([`seo.md`](./seo.md)).

## Gotchas

- **`JOIN_CONSENT_VERSION` changes with the text under the `/join` button.**
- **Rotating `JWT_SECRET` forgets every member**: they land on `/join` again, and joining with their email gives them back the page.
- **A role is declared in four places**: `LAB_ROLES` and `ROLE_OPTIONS` (the Lab), and in MyTwinOS `CRM_LAB_ROLES`, the `CrmLabRole` SDL enum, `TYPE_BY_LAB_ROLE`.

## TODO

- [x] **Privacy policy**: § 4.6 *Joining the Lab community* (consent, until unsubscribed, record deleted 3 years after the last contact), Resend in § 8, the `lab_member` cookie in § 9 (2026-10-09). The health story section went with the story (2026-10-10).
- [ ] **Unsubscribe.** The consent line and the policy promise it from each newsletter: the link comes with the newsletter tooling, before the first newsletter is sent. The welcome email has none.
- [ ] **mytwin.care: the anecdote consent text says the story is « processed anonymously »**, but it is stored attached to the contact (so it can be deleted on request). The checkbox could say what is true (read by the team only, never published, de-identified if quoted) — with a new `HEALTH_ANECDOTE_CONSENT_VERSION`.

Related: [`booking.md`](./booking.md) · [`seo.md`](./seo.md) · [`index.md`](./index.md)
