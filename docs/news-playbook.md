# MyTwin Lab News — editorial playbook

> How to decide, write and publish a news on `/news`. A living document: when an article needs a rule that isn't here, add the rule, then log the decision at the bottom. The code side (where files go, what the template renders) is in [`news.md`](./news.md).

Upstream, and never contradicted here: the MyTwin SEO strategy in the mytwin-health-landing repo (`docs/seo-strategy.md`: entity, YMYL rules, no cannibalization) and the Lab's own decisions in [`seo.md`](./seo.md).

---

## 1. What the news are for

MyTwin Lab is an open sandbox: things are built in steps, in public. The news tell those steps, **as a continuing story**. A prototype gets a news, then its study gets another one, and that one points back to the first.

In the MyTwin search ecosystem, each site has its own job:

| Property | Its job in search | Its queries |
|---|---|---|
| mytwin.care landings | convert | "MyTwin for clinicians", "for employers"… |
| mytwin.care blog | build topical authority, one informational intent per article | "patient digital twin", "AI in medical imaging", "second medical opinion"… |
| MyTwin Lab pages | the Lab itself, its challenges and Sandbox projects | "MyTwin Lab", "open mammography AI challenge"… |
| **MyTwin Lab News** | **events and relationships** | "Virtuosis AI MyTwin", "MyKine physiotherapy app", "MyTwin sports injury prediction" |

What a news captures, concretely:

1. **Entity pairs.** *MyTwin + partner*, *MyTwin Lab + project*. Every partner news states the relationship MyTwin → partner → capability, in the text, in the JSON-LD `mentions`, and ideally in a link back from the partner's own site. This is what separates MyTwin from its homonyms in search.
2. **The Lab's long tail.** Challenges and Sandbox projects are thin, app-like pages; a news gives them context, a date and inbound links.
3. **Freshness and trust.** Dated, sourced, signed news are the proof that the Lab is alive and honest about where each project stands.

A news does **not** try to rank for an informational query. When the reader needs to *understand* the topic, the news links to the mytwin.care article that owns it.

## 2. What deserves a news

A real event, with a date, that changes something for the Lab or MyTwin:

| Category | Examples of events | Not a news |
|---|---|---|
| `partnership` | a technology integrated into MyTwin (pilot, beta, live); a partner joining the Lab | a first meeting; a partner that hasn't agreed to be named |
| `challenge` | a challenge opens; its results are in; a model is validated | a challenge's description edit |
| `sandbox` | a notable project is proposed; it gets promoted to a challenge; it ships | every new sandbox |
| `research` | a prototype works; internal benchmarks; a study is published | an idea without a prototype |
| `community` | the Lab launches; a milestone of contributors; an event | a routine leaderboard update |

**The one-sentence test.** If the news can't be summarised as *"On [date], [who] [did what], which means [why it matters]"*, it isn't ready.

## 3. Continuity — news as chapters

Each project moves through stages. Name them the same way everywhere:

`idea → prototype → internal benchmark → pilot (private beta) → study → published results → live`

- **A follow-up news links back** to the previous chapter in its first paragraphs: *"In August 2025 we built a first prototype ([read](…)). Today, the study…"*.
- **The previous chapter is updated**: a short `NewsCallout` at the top of its intro (*"Update, March 2027: the study is out → link"*) and `updatedAt` set, because the substance changed. Never rewrite history: the original text stays.
- **One news per chapter.** Don't reopen an old news to add a new event; write the new chapter.

When a project reaches two chapters or more, it's time to add a "story so far" timeline to the template (not built yet — see `news.md`).

## 4. No cannibalization

Before writing, check three places:

1. **The mytwin.care blog** (`src/features/blog/articles/` in mytwin-health-landing). Current articles and their queries:
   `patient-digital-twin` · `predictive-health` · `real-world-data-patient-monitoring` · `remote-patient-monitoring` · `ai-medical-imaging` · `second-medical-opinion` · `personal-health-record` · `workplace-heart-health` · `measure-workplace-health-program` · `personalized-workplace-health-privacy`.
   A news never titles on one of those queries: it links to the article instead (e.g. a mammography challenge news links to *AI in medical imaging* for the conditions of trust).
2. **The Lab's own pages.** A challenge or sandbox page owns the *what* and the *how to contribute* (brief, rewards, rules). The news tells the *why* and the *when*, and links to the page. `/about` owns the evergreen explanation of the Lab; the launch news tells the event.
3. **The other news.** One event, one news. Two news about the same partner are two chapters, never two versions.

"Digital twin" belongs to mytwin.care: never the main query of a news title.

## 5. Anatomy of a news

The template renders the frame (`news.md`); the article provides these fields.

| Field | Rule |
|---|---|
| `title` (H1) | Entity-first, says the event: *"Virtuosis AI brings voice analysis to MyTwin"*. No clickbait, no question. |
| `overviewTitle` | The title of the cards: short and catchy (*"MyKine turns a phone camera into a physio’s measuring tool"*). It may drop the entity pair, never the YMYL rules: no diagnosis, no availability the news doesn't state. |
| `seoTitle` | ≤ ~48 characters (the template appends ` \| MyTwin Lab`). The entity pair first. |
| `description` | ≤ ~155 characters. The event + why it matters. Written for the person searching, not a copy of the lead. |
| `excerpt` | 1–3 sentences under the H1 and on the cards. |
| `eventMonth` | `YYYY-MM`, when the event happened. Orders the news. |
| `publishedAt` | The day the article goes live. **Never backdated**, even for an event from 2025. |
| `updatedAt` | Only when the substance changes (a new chapter, a correction). |
| `facts` | *At a glance*: 3–6 lines. Always **When**, **Stage**, and **Who** (partner, contributor, team); then what matters (data, platform, links). |
| `intro` | The lead: who, what, when, stage, why it matters, in 2–4 short paragraphs. A reader who stops here knows the news. |
| `sections` | As many as the story needs (often 2–4). H2s that say something (*"What the prototype measured"*), not labels (*"Details"*). From 3 sections, the template adds a table of contents. |
| `faq` | Optional. Only questions a reader actually asks (*"Can I use it today?"*, *"Can I contribute?"*). Never to pad. |
| `cta` | One action, the one the news makes possible: star the project, join the challenge, watch the episode, discover MyTwin. |
| `sources` | Every external claim. Partner and official pages count as sources for what they state about themselves. |
| `mentions` | Every organisation, person or product the news is about, with its official URL. |
| `keywords` | 4–8, the entity pairs and the project's own terms. |
| `illustration` | Optional. A photo or a drawn visual for the overviews. Same rule as the visual blocks below: it illustrates, it adds nothing. |

**Length.** Say what there is to say, nothing more: a partnership in pilot may take 400 words, a challenge with a vision 1,000. Never stretch a news to look like a blog article, never cut one that has a real story.

**Visual blocks.** Welcome when they show something better than text: a pipeline, a stage timeline, what a model measures. A block **illustrates, it adds nothing**: every label comes from the text, no invented figure, no fake result, no mock dashboard with numbers. Wrap it in `NewsFigure`. The MyTwin Inside episode about a partner is embedded with `PodcastEpisodeEmbed`.

## 6. Wording — health is YMYL

These are floor rules, inherited from the MyTwin SEO strategy and made concrete for news.

1. **Say the stage, always.** *Prototype*, *internal benchmark*, *pilot in MyTwin's private beta*. Never let a pilot read as a product anyone can use today.
2. **Signals, not diagnoses.** *"signals associated with stress"*, *"estimates"*, *"flags"*; never *"detects Alzheimer's"*, *"predicts injuries"*, *"diagnoses"*. MyTwin is never a substitute for a health professional.
3. **Figures.** An external figure needs its source, linked. An internal figure is allowed only when labelled as internal, with **what it does not say**: *"flagged more than 80% of injuries (sensitivity); false alarms not measured yet; not peer-reviewed"*. No figure that can't be explained that way.
4. **Attribute what partners claim.** *"According to i-Virtual, …"*. Studies written or funded by the partner are presented as such.
5. **Regulatory status, exactly as registered.** A CE marking appears only with its class and scope, linked to EUDAMED or the instructions for use: *"Caducy is registered as a class IIa medical device for heart rate and respiratory rate"*. A class I device is self-declared by its maker: never write "certified". What the partner doesn't claim publicly, we don't claim for them.
6. **Titles of people.** Name and role as they present themselves publicly (*"Sébastien Saliques, hospital pharmacist"*). No "Dr" unless verified.
7. **Consent before publishing.** A partner, a contributor or a guest named in a news has agreed to it — especially for early-stage relationships ("in discussion", "joining").
8. **The author.** News are signed Rubens Valcy, founder of MyTwin, for now. Never a fake "reviewed by".

## 7. Links

Links are part of the content, not decoration. Each one has to help the reader.

| Link to | When | How |
|---|---|---|
| The Lab page of the project (`challengePath`, `sandboxPath`) | always, when one exists | in the lead and in the CTA |
| `/about`, `/challenges`, `/sandbox` | when the reader needs the context | once |
| The previous or next chapter | continuity (§3) | in the lead |
| mytwin.care — the landing or blog article owning the topic | when the reader needs to understand, or to see the product | once, descriptive anchor |
| The partner's official site | always for a partnership | first mention; editorial link, no `nofollow` |
| Scientific and institutional sources | every external claim | inline + listed in *Sources*; prefer WHO, EU Commission, national agencies, peer-reviewed papers (PubMed Central, DOI) |

Anchors say where they lead (*"the MASAI randomised trial"*), never *"here"*. `NewsLink` picks the right behaviour (same tab for the Lab and mytwin.care, new tab for the rest).

## 8. Publishing checklist

- [ ] The one-sentence test passes (§2), and no existing content owns the query (§4).
- [ ] Stage, dates and names checked with the team; people and partners named have agreed.
- [ ] Every external claim has a working source; every internal figure says what it doesn't measure.
- [ ] `title`, `seoTitle`, `description` within limits; `eventMonth` and `publishedAt` right.
- [ ] Links: project page, mytwin.care, partner, sources. All return 200.
- [ ] `mentions` filled with official URLs.
- [ ] `npm run type-check`, `npm run test` and `npm run build` pass; the page is checked on mobile and desktop.
- [ ] If it continues a story: the previous chapter gets its update callout and `updatedAt`.
- [ ] After deploy: the page and `/sitemap.xml` answer in production, then *URL Inspection → Request indexing* in Search Console.
- [ ] Ask the partner for a link to the news from their own site.

## 9. Decision log

| Date | Article | Decision |
|---|---|---|
| 2026-09-16 | — | News are English only, like the whole Lab. Signed Rubens Valcy. `NewsArticle` schema. Categories: partnership, challenge, sandbox, research, community. |
| 2026-09-16 | first batch | Events from 2025 are published with today's `publishedAt` and their real `eventMonth`: no backdating. |
| 2026-09-16 | racket-sport injuries | The ">80%" figure is kept, labelled as an internal benchmark on sensitivity only, with false alarms not measured and a study to come as its own news. The reference injuries were those reported in the press: said in the text, with its limit. |
| 2026-09-16 | partner news | Written from what was said on MyTwin Inside, with the partners' agreement. What a guest claims is attributed to them; figures without a published source are left out. A regulatory class appears only as the partner states it (Skinive, Ensweet); Virtuosis claims none publicly, so none is given. |
| 2026-09-16 | i-virtual | The product in MyTwin is Saphere, which i-Virtual doesn't present as a medical device. Caducy's CE scope (heart rate, respiratory rate) is mentioned as a separate product, with its contraindication for the darkest skin types. |
| 2026-09-16 | mammography | Event month July 2026. Contributors named by first name, Alix and Hedi, as agreed. The vision (free AI second opinion in MyTwin for Patients, hospital licences) is stated with the steps it requires, and nothing is presented as available. |
| 2026-09-16 | healthguard | Sébastien Saliques is presented as a hospital pharmacist, as he presents himself. HealthGuard is an alpha: no compliance is implied. |
| 2026-09-21 | all | Each news gets an `overviewTitle` for its cards, shorter than the H1, which keeps the entity pair for search. Illustrations are optional and chosen per news; five news have none. |
| 2026-09-21 | mytwin-accessibility | Category `research`: a first accessibility pass on the app, written from the team's account. The voice-driven mode is presented as an idea, nothing built. No accessibility challenge exists yet, so the CTA leads to the Sandbox; it should point to the challenge once it opens. External figures (WHO, WebAIM) are sourced; no claim about the app's current level of accessibility. |
