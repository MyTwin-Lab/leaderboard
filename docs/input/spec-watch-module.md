# Spec — Module `watch` : explorateur de publications santé (V1)

Statut : prêt pour implémentation
Cible : Claude Code, repo `leaderboard`
Langue UI : anglais (contributor-facing)

---

## 1. Pitch

Le Lab travaille sur des sujets où la littérature bouge vite. Aujourd'hui, suivre ce qui sort demande d'aller sur PubMed, de bricoler des requêtes, et de trier à la main les papiers qui comptent de ceux qui remplissent. L'inspiration vient d'un script perso de veille (OpenAlex → filtre sur l'impact de la revue → rapport hebdo) qu'on veut transformer en outil partagé, accessible depuis la plateforme.

Le module `watch` ajoute une page **Watch** : une barre de recherche sur toute la littérature santé, des filtres qui parlent (topics, période, open access, revues à fort impact), et des résultats lisibles d'un coup d'œil — titre, revue, score, abstract dépliable, lien PubMed. Pas de flux à configurer, pas de cron : on cherche, on lit, on ferme. Le suivi automatique de requêtes viendra après, une fois qu'on aura vu ce que les gens cherchent vraiment.

Source de données : **OpenAlex** (API publique, gratuite, plus large que PubMed, expose les métriques de citation). Le PMID est conservé pour renvoyer vers PubMed, source canonique côté clinique.

---

## 2. Périmètre V1

Inclus :
- Module `watch` activable depuis l'onglet Modules (même mécanique que `digest` / `sandbox`).
- Page `/watch` : recherche + filtres + résultats paginés. 404 quand le module est désactivé.
- Une route API serveur qui proxifie OpenAlex, normalise la réponse, gère cache et rate limiting.
- Score d'impact de la revue (`2yr_mean_citedness`) affiché sur chaque résultat, avec un cache persistant des revues.
- Filtre « high-impact journals only » (seuil configurable, défaut 9.0).

Hors périmètre (explicitement V2) :
- Persistance des résultats, recherches sauvegardées, cron d'ingestion, section dans le digest.
- Rattachement d'une recherche à un challenge (bloc « recent papers » sur le brief).
- Résumé ou traduction par LLM.
- Favoris / annotations par contributeur.

---

## 3. Module

Enregistrement dans `modules/watch/index.ts`, déclaré dans la composition root (`distribution/`) comme les autres modules produit.

Settings (éditables depuis l'onglet Modules, admin) :

| Clé | Type | Défaut | Rôle |
|---|---|---|---|
| `openalex_mailto` | string | vide | Email pour le polite pool OpenAlex. Obligatoire pour activer le module. |
| `default_domain_ids` | string[] | `["4"]` | Domaines OpenAlex appliqués par défaut. `4` = Health Sciences. Vérifier les ids via `GET https://api.openalex.org/domains` à l'implémentation. |
| `high_impact_threshold` | number | `9.0` | Seuil de `2yr_mean_citedness` pour le filtre « high-impact ». |
| `page_size` | number | `25` | Résultats par page (max 50). |
| `cache_ttl_seconds` | number | `600` | TTL du cache de requêtes. |

Accès : page réservée aux utilisateurs connectés (toute session valide). Pas de rôle spécifique.

Aucun job cron en V1. Aucune dépendance à une intégration.

---

## 4. Page `/watch`

Layout : barre de recherche en haut, panneau de filtres à gauche (drawer sur mobile), liste de résultats, pagination en bas. Composants dans `components/watch/`.

### Barre de recherche
- Champ texte, placeholder `Search health publications…`.
- Debounce 400 ms ; requête lancée aussi sur Entrée.
- Champ vide + aucun filtre → état initial : texte d'aide et 3-4 exemples de requêtes cliquables (ex. `hepatocellular carcinoma`, `mammography deep learning`).

### Filtres
| Filtre | UI | Défaut |
|---|---|---|
| Search in | Radio : `Title + abstract` / `Title only` | Title + abstract |
| Period | Chips : `30 days` / `6 months` / `1 year` / `5 years` / `Any` | 1 year |
| Topics | Chips multi-select alimentés par les facettes renvoyées par l'API (voir §5). Affiche le libellé + le compte. Max 10 chips visibles, bouton « more ». | aucun |
| Open access only | Toggle | off |
| High-impact journals only | Toggle, libellé avec le seuil (`journals with 2yr citedness > 9`) | off |
| Min. citations | Input numérique | vide |
| Sort | Select : `Relevance` / `Newest` / `Most cited` | Relevance (Newest si search vide) |

Tous les filtres sont reflétés dans l'URL (query params) pour que les recherches soient partageables.

### Carte résultat
- Titre (lien externe : PubMed si PMID, sinon DOI, sinon page OpenAlex).
- Ligne meta : revue · score revue (badge coloré si ≥ seuil) · date · citations · badge `OA` si open access.
- Auteurs : 3 premiers + `+N`.
- Topic principal en petit.
- Abstract replié par défaut (2 lignes), bouton « Show more ». Si absent : `No abstract available`.

### États
- Loading : skeletons.
- Zéro résultat : message + suggestion de relâcher les filtres.
- Erreur OpenAlex (5xx, timeout, rate limit) : toast + bouton retry, la dernière liste reste affichée.

---

## 5. API interne

### `GET /api/watch/search`

Réservée aux sessions authentifiées. Module désactivé → 404.

Query params :

| Param | Type | Notes |
|---|---|---|
| `q` | string | Texte libre. Optionnel. |
| `scope` | `all` \| `title` | Défaut `all`. |
| `from` | date ISO | Optionnel. |
| `to` | date ISO | Optionnel. |
| `topics` | string (ids séparés par `,`) | Ids de subfields/topics OpenAlex. |
| `oa` | `true` | Open access only. |
| `high_impact` | `true` | Post-filtre sur le score revue (voir §6). |
| `min_cited` | int | |
| `sort` | `relevance` \| `date` \| `cited` | |
| `page` | int | Défaut 1. |

Réponse :

```json
{
  "results": [
    {
      "id": "W123",
      "title": "…",
      "doi": "10.…",
      "pmid": "12345678",
      "url": "https://pubmed.ncbi.nlm.nih.gov/12345678/",
      "publication_date": "2026-09-01",
      "cited_by_count": 12,
      "is_oa": true,
      "oa_url": "https://…",
      "journal": { "source_id": "S456", "name": "…", "citedness_2yr": 11.3 },
      "primary_topic": { "id": "T789", "name": "…", "subfield": "Oncology" },
      "authors": ["…", "…", "…"],
      "authors_count": 8,
      "abstract": "…"
    }
  ],
  "facets": {
    "topics": [ { "id": "…", "name": "…", "count": 340 } ]
  },
  "total": 1234,
  "page": 1,
  "page_size": 25,
  "high_impact_truncated": false
}
```

Validation : `page_size` vient des settings, jamais du client. `page` borné à 40 (OpenAlex limite la pagination basique à 10 000 résultats).

---

## 6. Intégration OpenAlex

Client HTTP dans `lib/server/openalex.ts` (pas de SDK, `fetch` natif). Header `User-Agent: MyTwinLeaderboard/1.0 (mailto:<setting>)` et param `mailto` sur chaque appel. Pas de clé API.

### Requête `/works`

Construction du `filter` :
- `q` + `scope=all` → param `search=q` (pas dans le filter).
- `q` + `scope=title` → `title.search:q` dans le filter.
- Toujours : `type:article`, `primary_location.source.type:journal`, `language:en`.
- Domaines : `primary_topic.domain.id:` + `default_domain_ids` joints par `|`.
- `from` / `to` → `from_publication_date` / `to_publication_date`.
- `topics` → `primary_topic.subfield.id:a|b` ou `topics.id:a|b` selon le préfixe de l'id (subfield vs topic). Les facettes renvoient des subfields (voir plus bas), donc en pratique `primary_topic.subfield.id`.
- `oa` → `is_oa:true`.
- `min_cited` → `cited_by_count:>N`.

Tri : `relevance_score:desc` (uniquement si `search` est présent, sinon OpenAlex refuse), `publication_date:desc`, `cited_by_count:desc`.

`select=` pour ne rapatrier que les champs utiles : `id,title,doi,ids,publication_date,cited_by_count,open_access,primary_location,primary_topic,authorships,abstract_inverted_index`.

### Facettes
Second appel en parallèle sur les mêmes filtres (sans `topics`) avec `group_by=primary_topic.subfield.id`, `per-page=1`. On garde les 15 premiers groupes. Mis en cache avec la même clé que la recherche (hors `topics` et `page`).

### Abstract
`abstract_inverted_index` → reconstruction en triant les positions. Null → `abstract: null`. Certains éditeurs ne fournissent pas l'abstract à OpenAlex ; c'est normal, pas une erreur.

### Score de revue et filtre high-impact
`summary_stats.2yr_mean_citedness` est sur `/sources/{id}`, pas sur `/works`. Donc :
1. Pour chaque résultat de la page, résoudre le `source_id` via la table `watch_sources` (§7). Ids manquants ou plus vieux que 30 jours → appel `/sources?filter=ids.openalex:S1|S2|…` par lots de 50, upsert.
2. `high_impact=true` : demander `per-page=100` à OpenAlex, post-filtrer sur le seuil, renvoyer les `page_size` premiers. Pas de pagination au-delà dans ce mode ; si plus de `page_size` résultats après filtre, `high_impact_truncated: true` et l'UI affiche `Showing the first N high-impact results — narrow your search to see more`. Limitation V1 assumée.

### Rate limiting
- Cache serveur en mémoire (clé = params normalisés, TTL = setting). Suffisant pour une seule instance ; si déployé multi-instances, passer à Postgres (`watch_query_cache`) en V2.
- Garde-fou : max 5 requêtes OpenAlex/s par process (petit sémaphore), timeout 8 s, une seule tentative de retry sur 429/5xx après 500 ms.

---

## 7. Base de données

Une seule table nouvelle, migration standard. Rien de dynamique (règle « installs cold » respectée : aucune DDL par flow).

```sql
CREATE TABLE watch_sources (
  source_id        text PRIMARY KEY,        -- ex. S137773608 (sans préfixe URL)
  display_name     text NOT NULL,
  citedness_2yr    numeric(8,3),
  refreshed_at     timestamptz NOT NULL DEFAULT now()
);
```

Repository `WatchSourceRepository` : `findMany(ids)`, `upsertMany(rows)`. Pas de delete.

---

## 8. Tests

- Unit : reconstruction d'abstract (index vide, positions non contiguës, null), construction du `filter` pour chaque combinaison de params, normalisation de la clé de cache.
- Route : 404 module off, 401 sans session, 400 sur params invalides, réponse conforme au schéma avec un mock OpenAlex.
- Intégration (un test, tag `external`, skippé en CI) : appel réel sur `search=hepatocellular carcinoma`, vérifie qu'on obtient ≥ 1 résultat avec un `journal.citedness_2yr` non null.

Critères d'acceptation :
1. Module désactivé → `/watch` et `/api/watch/search` renvoient 404.
2. Recherche `mammography` avec période 1 an renvoie des résultats en < 3 s (cache froid).
3. Toggle high-impact réduit la liste et affiche le bandeau de troncature quand > `page_size` résultats.
4. Recharger l'URL d'une recherche filtrée restitue exactement les mêmes filtres.
5. Une même recherche relancée dans le TTL ne déclenche aucun appel OpenAlex (vérifiable en log).

---

## 9. Pistes V2 (pour mémoire, ne pas implémenter)

- « Follow this search » : sauvegarde des params → job cron `watch.fetch` hebdo → table `publications` → section `new_publications` dans le digest.
- `challenge.watch_query` : bloc « Recent papers » sur le brief d'un challenge.
- Résumé LLM « why it matters » via l'agent existant, à la demande, jamais en batch.
- Favoris par contributeur.
