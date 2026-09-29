# The vitrine design system

The redesign of the public pages (home, challenges, sandbox, leaderboard, news, watch, profile, booking, sign-in) follows one design system, called **vitrine** after the Claude Design mock-ups it was taken from. Since September 2026 every floating surface of the app — drawers, modals, confirmations, toasts — and every create/edit form sits on it too, so a form opened from an old admin page looks like the page it will send you to.

## Where it lives

| File | Purpose |
|---|---|
| `src/components/vitrine/vitrine.css` | The tokens (`--v-bg`, `--v-surface`, `--v-ink`, `--v-muted`, `--v-subtle`, `--v-line`, `--v-accent`, `--v-night`…), the element reset, and the page grammar of the three listings: header, search capsule, pills, tabs, cards, empty state, night strip. |
| `src/components/vitrine/forms-vitrine.css` | The shared vocabulary of **drawers, modals and forms** — see below. |
| `src/components/vitrine/fonts.ts` | The three families (Plus Jakarta Sans for headings and figures, Hanken Grotesk for text, Instrument Serif for display), loaded by `next/font`. `vitrineFontVars` is the class string to put on a root. |
| `src/components/vitrine/Drawer.tsx` | The side panel that slides in from the right. |
| `src/components/vitrine/Modal.tsx` | The centered card. |
| `src/components/vitrine/VitrineEmbed.tsx` | The root of a vitrine fragment placed in a page that is not a vitrine (an inline admin form). |
| `src/components/**/*-vitrine.css` | One sheet per page or area, scoped under its own class (`.v-sandbox`, `.v-pro`, `.v-cd`…), holding only what is proper to it. |

## Roots

Everything is scoped: tokens and reset exist only under a root class, and every class is prefixed `v-`. Nothing leaks into the rest of the web app.

- `.vitrine` dresses a whole page: tokens, typography, reset, plus the full-height layout.
- `.vitrine-embed` brings only the material — tokens, typography, reset — for a fragment inside a page that is not a vitrine: the tab pills of a challenge page, an admin form, and **every floating surface**. A drawer or a modal is portaled to `document.body`, often from an old dark page, and without the tokens nothing would be dressed. `Drawer`, `Modal`, `VitrineEmbed`, `ToastProvider` and `ConfirmDialogProvider` set it themselves.

Both roots also carry `vitrineFontVars`, otherwise the fonts fall back to the system ones.

The reset is written with `:where()` (zero specificity), so any component class overrides it. The light-mode `!important` overrides of `globals.css` on inputs, textareas and SVGs are neutralised under both roots: the mock-up sets every colour itself.

## The rule that matters

**No Tailwind colour utility inside a vitrine surface.** `text-white/…`, `bg-white/…`, `border-white/…`, `bg-brandCP/…`, `text-brandCP`, `text-red-400`, `bg-background`, `var(--foreground)`, `var(--background-dark)`: `globals.css` rewrites the white ones in light mode, and a vitrine surface is light in both modes, so they are either invisible or wrong. Layout utilities (`flex`, `grid`, `gap-*`, `w-full`, `h-4`…) are fine.

`fgAt()` from `challengeFormFields.tsx` now dims `--v-ink` under a vitrine root (and falls back to the Lab foreground elsewhere). It is kept for leftovers; new text takes `.v-help` or `.v-label`.

## The shared vocabulary (`forms-vitrine.css`)

| Family | Classes |
|---|---|
| Drawer | `v-drawer` (`data-open`), `v-drawer-backdrop`, `v-drawer-panel` (`data-size` sm/md/lg), `v-drawer-head`, `v-drawer-icon`, `v-drawer-head-text`, `v-drawer-title`, `v-drawer-sub`, `v-drawer-close`, `v-drawer-body`, `v-drawer-foot` |
| Modal | `v-modal` (`data-center`), `v-modal-backdrop`, `v-modal-card` (`data-size`, `data-anim="pop"`), `v-modal-head`, `v-modal-icon` (`data-tone="danger"`), `v-modal-title`, `v-modal-sub`, `v-modal-close`, `v-modal-actions` (`data-align="end"`), `v-modal-submit` (`data-valid`), `v-modal-cancel`, `v-modal-hint` |
| Fields | `v-field` (dresses the input/textarea/select it contains), `v-field-label`, `v-field-hint`, `v-field-error`, `v-label` (small caps, with an icon), `v-label-required`, `v-input`, `v-textarea`, `v-select`, `v-num` + `v-num-unit`, `v-fields` (grid), `v-field-row`, `v-help` (`data-size="xs"`), `v-code`, `v-locked`, `v-bare` (an input with no box of its own) |
| Slug | `v-slug`, `v-slug-prefix`, `v-slug-state` (`data-ok`), `v-slug-use`, `v-slug-status` (`data-tone` ok/error) |
| Buttons | `v-btn` (ink pill; `data-tone` accent/success), `v-btn-quiet` (outlined; `data-on`), `v-btn-text` (`data-tone` accent/danger), `v-btn-danger`, `v-btn-icon` (`data-tone="danger"`), `v-btn-sm`, `v-spin` |
| Switches and choices | `v-toggle` + `v-toggle-knob` (`data-on`), `v-switch-row` / `v-switch-text` / `v-switch-label` / `v-switch-desc`, `v-choices` / `v-choice` (`data-on`, `data-locked`) / `v-choice-text` / `v-choice-name` / `v-choice-hint`, `v-status` + `v-status-dot` (`--v-dot`) |
| Dropdown | `v-dd`, `v-dd-trigger` (`data-open`, `data-empty`), `v-dd-menu`, `v-dd-option` (`data-on`) |
| Groups | `v-section` / `v-section-title` / `v-section-head`, `v-divider`, `v-disclose` (`data-open`), `v-note` / `v-note-title`, `v-alert` (`data-tone` warning/success/info), `v-form`, `v-form-foot`, `v-embed-card` |
| Lists and reading | `v-rows` / `v-row` (`data-quiet`) / `v-row-text` / `v-row-title` / `v-row-meta` / `v-row-actions`, `v-badge` (`data-tone` accent/success/warning/danger/info/night), `v-bar` / `v-bar-fill`, `v-figure` / `v-figure-value` / `v-figure-unit`, `v-dl`, `v-pre`, `v-quiet` (`data-busy`) |
| Toasts | `v-toasts`, `v-toast` (`data-tone`), `v-toast-text` |

The modal, field and slug classes were first written for the sandbox modal (`sandbox-vitrine.css`) and moved here when every surface adopted them; that sheet keeps only what is proper to a proposal (type choice, cover, starting point).

When a surface needs a class of its own, it goes in a sheet next to the component with its own prefix (`v-cdr-` for the challenge drawer — `v-cd-` is already the challenge page —, `v-ce-` for the editors rendered in it, `v-eg-` for the evaluation grids, `v-af-` for the admin forms, `v-co-` for the challenge overlays, `v-ob-` for the onboarding drawer), on the same tokens. `forms-vitrine.css` only grows with what at least two surfaces share.

## Components

- **`Drawer`** — `open`, `onClose`, `title`, `subtitle`, `icon`, `footer`, `size`. Always mounted, it slides on `open`; Escape closes it; portaled to `document.body` under its own `.vitrine-embed` root.
- **`Modal`** — `open`, `onClose`, `title`, `subtitle`, `icon`, `tone`, `actions`, `size`, `center`, `above`. Unmounted when closed (it plays an arrival, not a slide). The sandbox modal keeps its own genie animation on the same classes.
- **`VitrineEmbed`** — `card` draws the white surface and its hairline, `title` its heading, for a form placed on a dark admin page. The page owns the card and the title (`app/admin/*/page.tsx`); the form inside stays bare, so two frames are never drawn.
- The shared primitives in `components/ui/` that only live inside forms are on the vocabulary: `FormField` / `FormSection` / `FormFooter` (+ `inputClass`, `selectClass`), `SelectDropdown`, `Toggle`, `SlugField`, `ConfirmDialog`, `Toast`; so are `Field` / `LockedValue` of `components/admin/challengeFormFields.tsx`. `Button`, `Badge` and `Card` stay on the Lab style because the admin lists and tables that use them have not moved. `TabPills` and `Markdown` carry a `variant="vitrine"`.

## The surfaces on it

Drawers: the challenge drawer (create, edit, promote) and its per-flow sections and editors; the meeting drawer; the documents and reward-rules drawers of a challenge; the grid, category and criterion drawers of the evaluation grids; the onboarding drawer. Modals: sandbox, join, group invite, evaluation detail, team, repo link, participants, repo and evaluation-run details, the confirmation dialog, the session guard. Inline forms: the admin project, meeting, contribution, repo and grid forms, the reference-case author panel, the profile forms (`v-pro-*`), the booking form (`v-book-*`).
