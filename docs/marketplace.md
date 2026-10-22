# MyTwin Marketplace

> `/marketplace`, the catalog of reusable MyTwin modules, each with the same six-section specification. `noindex`, out of the sitemap, reached only by its URL.

The Marketplace is a **catalog**, not a shop: no payment, no developer account, no installation, no API subscription. It serves developers, clinics and MyTwin's commercial teams from the same module pages.

## Surface

| Path | What it is |
|---|---|
| `/marketplace` | Title and one-line intro, then "Choose your modules" with a "Modules Pricing Calculator" button (not wired yet), the ten module cards (image, name, description, provider, pricing) and a "More modules coming" tile |
| `/marketplace/<slug>` | One module's specification: header, six sections, previous / next module. One route for every module (`dynamicParams = false`: an unknown slug is a `404`) |

Nothing else on the site links to it: not the navbar, not the footer, not the home page. A `/mytwin-platform-sdk` vision page existed for a day and was removed (2026-10-23): it said nothing the catalog needed.

## Where it lives

| File | Purpose |
|---|---|
| `src/content/marketplace/index.ts` | **The registry**: `MARKETPLACE_MODULES`, in catalog order, plus `getMarketplaceModule()` and `moduleNumber()` |
| `src/content/marketplace/modules/*.ts` | One file per documented module (the first three, from their official references) |
| `src/content/marketplace/types.ts` | `MarketplaceModule`, `ModuleSpecification`, `SpecEntry`, `PricingTerms` |
| `src/content/marketplace/spec.ts` | `SPEC_SECTIONS` (the six sections, their numbers, titles and standard fields), `undocumentedSpecification()` |
| `src/content/marketplace/format.ts` | Labels, `pricingSummary()`, `pricingEntries()`, `isSectionDocumented()`: wording only, no content |
| `src/components/marketplace/` | `ModuleCard`, `ModuleCatalog`, `ModuleSpecificationView` (all server components), `icons.tsx`, `marketplace-vitrine.css` |
| `public/marketplace/modules/<slug>.webp` | Each module's image |
| `src/app/marketplace/` | The routes; `layout.tsx` carries the segment's `noindex` |

The card keeps only the provider and the price; type, availability and integration are in the specification. No JavaScript ships for the catalog: the registry never reaches the client bundle.

## The module specification (V1)

Every module has the same six sections, in this order and with these titles: **01 Overview · 02 Capabilities · 03 Integration · 04 Pricing · 05 Licensing · 06 Compliance & Trust**. They always exist in the data, even empty.

A section is an optional `intro`, a list of `entries` (`{ label, text?, items?, maturity? }`), optional `notes`; Compliance & Trust adds `references` (external standards and guidance, never a certification).

- An entry with neither `text` nor `items` renders **"Not documented"**. That is how a specification says what it does not know.
- `maturity: "planned"` or `"to-confirm"` adds a badge: a planned capability must not read as an acquired one.
- A section with nothing documented collapses to one "Not documented" mention listing the fields it will cover, so the seven undocumented modules stay readable.
- Overview always shows the module's provider, platform layer and availability, which are known even without a specification.

## Adding or updating a module

1. **A new module without a specification**: add an `undocumentedModule({ slug, name, provider, moduleType, shortDescription })` entry to `MARKETPLACE_MODULES`, at its place in the catalog, and its image at `public/marketplace/modules/<slug>.webp` (square, 800px, like the others). It appears in the catalog and at `/marketplace/<slug>`: nothing else to touch.
2. **Documenting a module**: replace its `undocumentedModule(...)` entry with a file in `modules/` (copy one of the three existing ones), and fill only what the reference document establishes. Keep "Not documented" lines for what it leaves open.
3. **Never change a slug** once the URL has circulated: it is the module's address.
4. Update the registry test (`marketplace.test.ts`), which pins the order and which modules are documented.

## Images

The images are the brochure's ("MyTwin modules"), taken from mytwin.care, where the `/clinic-partner-program` deck uses them (`mytwin-health-landing/public/clinicians/modules/`), and renamed after the module's slug. Same pairing as the deck: the medical record shows `daily-followup` (a doctor in front of records), as it has no image of its own. MyTwin Engine and Dynamic Care Plan are not in the brochure: they take `what-if-scenarios` (branching scenarios, not a score, since the Engine is not a scoring model) and `care-plans`. The "More modules coming" tile has no image: a dashed frame and a "+", so that it never reads as a module. Images are decorative (`alt=""`): the title next to them already says what they show.

## Card descriptions

Each card description comes from the commercial brochure ("MyTwin modules"), word for word, except MyTwin Engine and Dynamic Care Plan, which are not in it: theirs are shortened from the "Public card description" of their reference.

## Documentation and pricing, later

- **Documentation**: set `documentationUrl` on the module only when the page exists. The card then shows a "Documentation" link, and the specification shows a button; until then, neither is rendered. `externalProviderUrl` works the same for a partner's site.
- **Pricing** is data, not text: `specification.pricing.terms` (`PricingTerms`) holds `model` (`per-patient-per-month`, `per-assessment`, `per-api-call`, `custom`), `billingUnit`, `unitPrice`, `currency`, `volumeTiers`, `setupFee`, `conditions`. The Pricing section's standard lines are generated from it, and the card summary reads it. A future multi-module estimator reads the same terms: the "Modules Pricing Calculator" button, next to "Choose your modules" (`ModuleCatalog`), is already there and does nothing until it is wired to it.
- A missing price is **never** zero or free: `pricingSummary()` returns `undefined` and the card writes "Not documented"; an amount without a currency is not shown. Publish no price that has not been approved commercially, and never a partner acquisition cost.

## Content rules

The first three modules come from their official references (`Centralized Medical Record`, `MyTwin Engine`, `Dynamic Care Plan`), kept as written. Their internal instructions ("do not imply…") became "Not documented" lines, and their *must* and *should* stay obligations, not statements of fact. Do not extend a medical or regulatory claim beyond what a reference establishes. Traceability is not certification, and a planned capability gets its `maturity`.

- Centralized Medical Record is the patient-facing side of the **Data Hub**, not a document store.
- MyTwin Engine **orchestrates** models; it is not a scoring model. Scores are separate modules.
- Dynamic Care Plan supports follow-up under clinician oversight; it does not diagnose, prescribe or guarantee emergency monitoring.
- e-sensia acquired the Saphere technology (formerly i-Virtual): module 05 reads "e-sensia / Saphere".
- "Others" in the brochure is not a module: it is the "More modules coming" tile.

## Indexing

`noindex, follow` on the catalog and every module page, through the metadata API, so it is in the server-rendered `<meta name="robots">`:

- `src/app/marketplace/layout.tsx` sets `robots: UNLISTED_ROBOTS` for the whole segment, so any module page, current or future, inherits it.
- Each page also declares it through `unlistedMetadata()` (`lib/seo.ts`): `pageMetadata()` plus `robots`.
- The sitemap is an explicit list (`buildSitemap`): these routes are not in it. A `noindex` URL in a sitemap lowers Google's trust in the whole file.
- Nothing in `robots.txt`: a `Disallow` would stop crawlers from ever reading the `noindex` ([`seo.md`](./seo.md)).

`noindex` is not private: the pages are open to anyone with the URL. Check what is served:

```bash
curl -s https://mytwinlab.care/marketplace | grep -o '<meta name="robots"[^>]*>'
curl -s https://mytwinlab.care/marketplace/mytwin-engine | grep -o '<meta name="robots"[^>]*>'
curl -s https://mytwinlab.care/sitemap.xml | grep -c marketplace   # 0
```

## Not built yet

An SDK, API keys, partner API integrations, a module runtime, a pricing calculator, payment, developer accounts, subscriptions, back-office tools. The pages state none of them as available.

Related: [`seo.md`](./seo.md) · [`design-system.md`](./design-system.md) · [`index.md`](./index.md)
