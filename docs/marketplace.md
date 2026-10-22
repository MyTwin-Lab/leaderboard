# MyTwin Marketplace and Platform SDK

> `/marketplace`, the catalog of reusable MyTwin modules, each with the same six-section specification; `/mytwin-platform-sdk`, the vision of a future unified developer interface. Both are `noindex`, out of the sitemap, and reached only by their URL.

The Marketplace is a **catalog**, not a shop: no payment, no developer account, no installation, no API subscription. It serves developers, clinics and MyTwin's commercial teams from the same module pages. The SDK page states an intent: no package, no code sample, no authentication.

## Surface

| Path | What it is |
|---|---|
| `/marketplace` | Intro, the three platform layers (Data Hub, Engine, Experience Layer), the catalog of module cards with a MyTwin / Partners filter, a "More modules coming" tile, a strip to the SDK page |
| `/marketplace/<slug>` | One module's specification: header, six sections, previous / next module. One route for every module (`dynamicParams = false`: an unknown slug is a `404`) |
| `/mytwin-platform-sdk` | "Integrate once. Access the MyTwin ecosystem.", status *Coming soon*, CTA to `/marketplace` |

The two pages link to each other, and nothing else on the site links to them: not the navbar, not the footer, not the home page.

## Where it lives

| File | Purpose |
|---|---|
| `src/content/marketplace/index.ts` | **The registry**: `MARKETPLACE_MODULES`, in catalog order, plus `getMarketplaceModule()` and `moduleNumber()` |
| `src/content/marketplace/modules/*.ts` | One file per documented module (the first three, from their official references) |
| `src/content/marketplace/types.ts` | `MarketplaceModule`, `ModuleSpecification`, `SpecEntry`, `PricingTerms` |
| `src/content/marketplace/spec.ts` | `SPEC_SECTIONS` (the six sections, their numbers, titles and standard fields), `undocumentedSpecification()` |
| `src/content/marketplace/format.ts` | Labels, `pricingSummary()`, `pricingEntries()`, `isSectionDocumented()`: wording only, no content |
| `src/components/marketplace/` | `ModuleCard`, `ModuleCatalog` (the only client component: the filter), `ModuleSpecificationView`, `icons.tsx`, `marketplace-vitrine.css` |
| `src/app/marketplace/`, `src/app/mytwin-platform-sdk/` | The routes; `marketplace/layout.tsx` carries the segment's `noindex` |

Content and UI stay apart: the registry names an icon by key (`"record"`, `"engine"`…), `components/marketplace/icons.tsx` maps it to a glyph. The catalog page renders the cards on the server and hands them to `ModuleCatalog` already rendered, so the registry never reaches the client bundle.

## The module specification (V1)

Every module has the same six sections, in this order and with these titles: **01 Overview · 02 Capabilities · 03 Integration · 04 Pricing · 05 Licensing · 06 Compliance & Trust**. They always exist in the data, even empty.

A section is an optional `intro`, a list of `entries` (`{ label, text?, items?, maturity? }`), optional `notes`; Compliance & Trust adds `references` (external standards and guidance, never a certification).

- An entry with neither `text` nor `items` renders **"Not documented"**. That is how a specification says what it does not know.
- `maturity: "planned"` or `"to-confirm"` adds a badge: a planned capability must not read as an acquired one.
- A section with nothing documented collapses to one "Not documented" mention listing the fields it will cover, so the seven undocumented modules stay readable.
- Overview always shows the module's provider, platform layer and availability, which are known even without a specification.

## Adding or updating a module

1. **A new module without a specification**: add an `undocumentedModule({ slug, name, provider, moduleType, shortDescription, icon })` entry to `MARKETPLACE_MODULES`, at its place in the catalog. It appears in the catalog and at `/marketplace/<slug>`: nothing else to touch. A new icon key goes in `ModuleIcon` (`types.ts`) and in `icons.tsx`.
2. **Documenting a module**: replace its `undocumentedModule(...)` entry with a file in `modules/` (copy one of the three existing ones), and fill only what the reference document establishes. Keep "Not documented" lines for what it leaves open.
3. **Never change a slug** once the URL has circulated: it is the module's address.
4. Update the registry test (`marketplace.test.ts`), which pins the order and which modules are documented.

Each card description comes from the commercial brochure ("MyTwin modules"), word for word, except MyTwin Engine and Dynamic Care Plan, which are not in it: theirs are shortened from the "Public card description" of their reference.

## Documentation and pricing, later

- **Documentation**: set `documentationUrl` on the module only when the page exists. The card then shows a "Documentation" link, and the specification shows a button; until then, neither is rendered. `externalProviderUrl` works the same for a partner's site.
- **Pricing** is data, not text: `specification.pricing.terms` (`PricingTerms`) holds `model` (`per-patient-per-month`, `per-assessment`, `per-api-call`, `custom`), `billingUnit`, `unitPrice`, `currency`, `volumeTiers`, `setupFee`, `conditions`. The Pricing section's standard lines are generated from it, and the card summary reads it. A future multi-module estimator reads the same terms.
- A missing price is **never** zero or free: `pricingSummary()` returns `undefined` and the card writes "Not documented"; an amount without a currency is not shown. Publish no price that has not been approved commercially, and never a partner acquisition cost.

## Content rules

The first three modules come from their official references (`Centralized Medical Record`, `MyTwin Engine`, `Dynamic Care Plan`), kept as written. Their internal instructions ("do not imply…") became "Not documented" lines, and their *must* and *should* stay obligations, not statements of fact. Do not extend a medical or regulatory claim beyond what a reference establishes. Traceability is not certification, and a planned capability gets its `maturity`.

- Centralized Medical Record is the patient-facing side of the **Data Hub**, not a document store.
- MyTwin Engine **orchestrates** models; it is not a scoring model. Scores are separate modules.
- Dynamic Care Plan supports follow-up under clinician oversight; it does not diagnose, prescribe or guarantee emergency monitoring.
- e-sensia acquired the Saphere technology (formerly i-Virtual): module 05 reads "e-sensia / Saphere".
- "Others" in the brochure is not a module: it is the "More modules coming" tile.

## Indexing

`noindex, follow` on all three routes, through the metadata API, so it is in the server-rendered `<meta name="robots">`:

- `src/app/marketplace/layout.tsx` sets `robots: UNLISTED_ROBOTS` for the whole segment, so any module page, current or future, inherits it.
- Each page also declares it through `unlistedMetadata()` (`lib/seo.ts`): `pageMetadata()` plus `robots`.
- The sitemap is an explicit list (`buildSitemap`): these routes are not in it. A `noindex` URL in a sitemap lowers Google's trust in the whole file.
- Nothing in `robots.txt`: a `Disallow` would stop crawlers from ever reading the `noindex` ([`seo.md`](./seo.md)).

`noindex` is not private: the pages are open to anyone with the URL. Check what is served:

```bash
curl -s https://mytwinlab.care/marketplace | grep -o '<meta name="robots"[^>]*>'
curl -s https://mytwinlab.care/marketplace/mytwin-engine | grep -o '<meta name="robots"[^>]*>'
curl -s https://mytwinlab.care/mytwin-platform-sdk | grep -o '<meta name="robots"[^>]*>'
curl -s https://mytwinlab.care/sitemap.xml | grep -c marketplace   # 0
```

## Not built yet

A real SDK, API keys, partner API integrations, a module runtime, a pricing calculator, payment, developer accounts, subscriptions, back-office tools. The pages state none of them as available.

Related: [`seo.md`](./seo.md) · [`design-system.md`](./design-system.md) · [`index.md`](./index.md)
