# Challenge 014 – Validation qualifiée par des professionnels de santé

## 1. Contexte & objectifs

- **Problème identifié** : les contributions produites sur le leaderboard alimentent l'application MyTwin (jumeau numérique du corps) — un contexte à vocation santé. Le système de validation actuel (voir `docs/validation-challenges.md`) fait valider un endpoint ML déployé par un vote majoritaire de n'importe quel contributeur connecté, sur la seule base de "ça a l'air de marcher". Ce mécanisme, pensé comme un simple sanity-check communautaire, devient la porte d'entrée vers un produit santé — ce qui ne peut plus reposer uniquement sur un jugement non qualifié.
- **Objectif** : remplacer le vote crowd par un vote réservé à des professionnels de santé qualifiés (`medical_pro`), et fiabiliser la preuve produite (conservation, traçabilité, justification) pour que le résultat d'une validation qualifiée soit exploitable comme preuve de vérification, pas seulement comme déclencheur de récompense.
- **Valeur attendue** :
  - Le verdict d'une validation qualifiée engage un jugement compétent, pas une moyenne d'opinions non qualifiées.
  - La preuve de ce qui a été testé et vu reste disponible dans la durée, au lieu d'être effacée à l'archivage du challenge.
  - Aucune nouvelle brique de gouvernance ajoutée en v1 (pas de statut de "promotion" séparé) — la résolution qualifiée fait déjà foi.

> Ce chantier ne tranche pas la classification réglementaire (IEC 62304 / ISO 14971 / MDR) ni la politique de rétention définitive des preuves — ces sujets sont notés pour un travail ultérieur avec Qara Pulse (cabinet QARA, voir échange précédent) et ne bloquent pas cette v1.

## 2. Portée

Concerne uniquement les challenges de type **validation** (`type: 'validation'`), tels que décrits dans `docs/validation-challenges.md`. Aucun changement sur les challenges `ml` ou `code`.

Inclus dans ce challenge :
1. Un nouveau rôle utilisateur `medical_pro`, au même niveau que `admin` / `contributor` / `viewer`.
2. La restriction du droit de voter (`POST /api/challenges/:id/validation-verdicts`) aux seuls utilisateurs `medical_pro` — le crowd-vote ouvert à tout contributeur connecté disparaît pour les nouveaux challenges de validation.
3. La justification (`description`) devient obligatoire sur un verdict `works` comme sur un verdict `broken` (elle n'était requise que pour `broken` jusqu'ici).
4. Le découplage de la purge des preuves (`file_bytes` / `response_bytes` de `validation_attempts`) de l'archivage du challenge — l'archivage n'efface plus automatiquement la preuve.
5. Le circuit de récompense (`cp_per_validation`, pool du challenge) reste strictement identique — un `medical_pro` côté majorité gagne des CP exactement comme un validateur crowd aujourd'hui. Pas de nouveau statut de "promotion vers MyTwin" : la résolution qualifiée du target *est* l'autorisation.
6. Des **cas de référence à vérité terrain** (entrée connue → sortie attendue), un par validation demandée sur le challenge, que chaque `medical_pro` doit réclamer et tester avant de pouvoir poser son verdict (voir 4.3).

Explicitement **hors périmètre** de ce challenge (voir aussi section 8) :
- La politique de rétention définitive des preuves (durée précise, conformité ISO 13485) — reporté, à traiter avec Qara Pulse.
- La classification de risque formelle par challenge (Classe A/B/C) — abandonnée au profit d'un modèle unique "tout challenge de validation est qualifié" (voir section 1).
- Aucune migration à prévoir : il n'existe encore aucun challenge de validation créé sur la plateforme à ce jour — ce nouveau système (rôle `medical_pro`, cas de référence, preuve non purgée) s'applique donc sans cas legacy à gérer.

## 3. Acteurs & permissions

| Acteur | Ce qu'il peut faire |
|---|---|
| **`medical_pro`** (nouveau rôle) | Voir les targets exposés sur un challenge de validation auquel il n'est pas lui-même soumissionnaire. Écrire des cas de référence à vérité terrain pour un challenge de validation. Réclamer un cas de référence non déjà pris sur un target, le tester, noter son observation, voir la sortie attendue, puis poser un verdict `works`/`broken` avec justification obligatoire. Gagne du CP si son verdict rejoint la majorité à la résolution du target. |
| **Contributeur** (rôle existant) | Ne peut plus voter sur un challenge de validation. Conserve tout le reste de son rôle actuel (soumettre une contribution `api_packaging`, etc.). |
| **Admin / manager du challenge** | Inchangé : configure le challenge, expose les targets, voit la répartition en direct avant résolution. Ne vote pas, sauf s'il détient également le rôle `medical_pro`. |

Un utilisateur `medical_pro` reste soumis à la règle existante d'auto-vote interdit (ne peut pas voter sur sa propre soumission), étendue aux cas de référence : il ne peut pas réclamer un cas qu'il a lui-même écrit.

## 4. Flux fonctionnel détaillé

### 4.1 Attribution du rôle `medical_pro`

1. Dans l'admin (`UserList`, où le rôle se change déjà par clic sur le badge), `medical_pro` devient un choix disponible à côté de `admin` / `contributor` / `viewer`.
2. Aucune notion de justificatif/diplôme tracé en v1 — l'attribution du rôle reste une décision manuelle de l'admin, comme pour les autres rôles aujourd'hui. (Une notion de compétence tracée pourra être ajoutée plus tard, hors v1.)

### 4.2 Vote sur un challenge de validation

1. Un `medical_pro` ouvre la page d'un challenge de validation, voit les targets exposés exactement comme un contributeur le voit aujourd'hui (réponse brute affichée par `ValidationOutputViewer`) — à ceci près que le fichier testé n'est plus libre : c'est un cas de référence réclamé, voir 4.3.
2. Que le verdict soit `works` ou `broken`, un champ de justification (`description`) est désormais requis — le formulaire bloque l'envoi sans texte.
3. Un utilisateur qui n'a pas le rôle `medical_pro` ne voit plus l'interface de vote sur un challenge de validation (ou la voit en lecture seule) — à traiter comme les autres écrans "droit insuffisant" du produit.
4. Le reste du flux de résolution (quorum `required_validations`, majorité, paiement CP) est inchangé — seul le vivier de votants change.

### 4.3 Cas de référence à vérité terrain

1. Un challenge de validation compte exactement `required_validations` cas de référence — ni plus, ni moins. Un cas de référence est une entrée connue (un fichier) associée à sa sortie attendue, écrite par un `medical_pro`.
2. Les cas de référence sont partagés par tout le challenge de validation, pas par target : la bonne réponse pour un cas donné ne dépend pas de quel contributeur est testé. Le même jeu de cas sert donc à qualifier chaque target exposé sur ce challenge.
3. En revanche, l'exclusivité de réclamation (claim) joue **par target** : un cas déjà réclamé sur le target A reste disponible pour être réclamé sur le target B, mais ne peut pas être réclamé deux fois sur le même target A.
4. Un `medical_pro` qui ouvre un target voit la liste des cas de référence pas encore réclamés sur ce target (ex. "5 cas disponibles"). Il en choisit un.
5. Réclamer un cas et compléter son test sont un seul et même geste — pas d'étape de réservation séparée qui pourrait rester bloquée si le validateur abandonne en cours de route. Si deux `medical_pro` réclament le même cas au même instant, la même règle de course déjà en place pour les tentatives de validation s'applique (seule la première écriture gagne, l'autre doit reprendre un cas encore libre).
6. Le fichier du cas réclamé est envoyé à l'endpoint réel exposé, exactement comme un fichier de test aujourd'hui (même proxy, mêmes garde-fous SSRF). Le `medical_pro` voit la réponse réelle et note son observation.
7. **Seulement après avoir enregistré cette observation**, la sortie attendue du cas de référence est révélée, affichée à côté de la réponse réelle — pour éviter que le `medical_pro` ne voie la bonne réponse avant de s'être fait son propre jugement sur la réponse réelle.
8. Le `medical_pro` pose ensuite son verdict final (`works`/`broken`) et sa justification, informé par la comparaison, mais le jugement reste humain — aucune comparaison automatique ne décide à sa place (voir section 1).

### 4.4 Conservation de la preuve

1. `purgeContentForChallenge` n'est plus appelée automatiquement depuis l'archivage d'un challenge (`apps/leaderboard-client/src/app/api/challenges/[id]/route.ts:85`).
2. En l'absence d'une politique de rétention définie (reportée, section 1), la preuve n'est plus purgée du tout en v1 — mieux vaut une preuve conservée trop longtemps qu'une preuve perdue avant qu'une politique existe.
3. Le code de purge (`validationAttempt.repo.ts:139`) n'est pas supprimé — il reste disponible pour être ré-appelé explicitement une fois une politique de rétention tranchée.

## 5. Règles & contraintes

- Seuls les utilisateurs `medical_pro` peuvent poser un verdict sur un challenge de validation — plus de crowd-vote ouvert.
- `description` obligatoire quel que soit le verdict.
- La preuve (fichier + réponse) n'est plus purgée automatiquement à l'archivage.
- Le mécanisme de CP reste identique (même pool, même `cp_per_validation`, même règle majorité gagne / minorité rien).
- Exactement `required_validations` cas de référence par challenge de validation, écrits par un `medical_pro`, partagés entre tous les targets du challenge ; réclamation exclusive par target.
- Un `medical_pro` ne peut pas réclamer un cas de référence qu'il a lui-même écrit.
- La sortie attendue d'un cas de référence n'est révélée qu'après que le `medical_pro` a enregistré son observation sur la réponse réelle — jamais avant, pour éviter le biais de confirmation.
- Le verdict final reste un jugement humain informé par la comparaison — aucun pass/fail n'est calculé ou imposé automatiquement par la plateforme.
- **Le déploiement de l'endpoint exposé reste sous contrôle exclusif du manager** : c'est le manager qui déploie le code soumis (`api_packaging`) sur son propre compte cloud (Scalingo, Scaleway, ou équivalent) et colle l'URL obtenue dans le formulaire d'exposition — le contributeur ne détient jamais les identifiants de cet hébergement. C'est ce qui empêche un contributeur de substituer un autre code derrière l'URL après qu'un verdict `works` a été posé ; aucun pin de version supplémentaire (commit SHA, etc.) n'est nécessaire tant que cette règle opérationnelle est respectée.
- Aucun challenge de validation n'existe encore sur la plateforme au moment de ce chantier — pas de compatibilité ascendante à gérer, le nouveau modèle (`medical_pro` + cas de référence) s'applique directement, sans variante crowd à conserver nulle part.

## 6. États d'une demande

Inchangé par rapport à `docs/validation-challenges.md` — seule la population autorisée à faire progresser le quorum change :

```
(target exposé) → N cas de référence disponibles à réclamer
                 → 0..N cas réclamés + testés + verdicts medical_pro reçus
                 → quorum atteint (required_validations = N cas tous réclamés)
                 → résolu (works | broken), CP payé à la majorité
```

## 7. Cas limites à couvrir

- **Aucun `medical_pro` n'existe encore sur la plateforme** au moment où un challenge de validation est créé : le target reste bloqué à "0 validation" indéfiniment — comportement déjà accepté aujourd'hui pour un target qui ne récolte jamais assez de votes (`docs/validation-challenges.md`, section Limitations v1).
- **Le rôle d'un utilisateur passe de `medical_pro` à autre chose** après avoir déjà voté sur un target non résolu : son verdict déjà enregistré reste compté (comportement par défaut proposé — à confirmer si un retrait rétroactif est plutôt souhaité).
- **Un `medical_pro` tente de voter sans remplir la justification** : rejeté côté validation de formulaire/API, même message d'erreur que pour un `broken` sans description aujourd'hui.
- **Le challenge de validation est configuré (`required_validations` fixé) avant que les cas de référence correspondants soient écrits** : les targets sont exposés mais aucun `medical_pro` ne peut voter tant que les N cas n'existent pas — même traitement que "0 cas disponible" en cas limite ci-dessus.
- **Deux `medical_pro` réclament le même cas de référence sur le même target au même instant** : seule la première écriture gagne (même garde-fou de course que les tentatives de validation aujourd'hui) ; l'autre doit reprendre un cas encore libre.
- **Un `medical_pro` tente de réclamer un cas de référence qu'il a lui-même écrit** : rejeté, même logique que l'auto-vote interdit sur sa propre soumission.

## 8. Hors périmètre / Limites connues (v1)

- Pas de suivi de compétence/qualification tracée pour le rôle `medical_pro` (diplôme, spécialité) — attribution manuelle par l'admin uniquement.
- Pas de politique de rétention formelle de la preuve — conservation par défaut, sans durée définie.
- Pas de comparaison automatique (similarité, tolérance numérique) entre la réponse réelle et la sortie attendue d'un cas de référence — l'objectivation reste une aide au jugement humain, jamais un pass/fail calculé (choix assumé, voir section 1).
- Pas de minimum de cas de référence par sévérité/cas limite imposé au-delà de `required_validations` — la diversité clinique des N cas reste à la discrétion des `medical_pro` qui les écrivent.

## 9. Questions ouvertes

Aucune question bloquante restante pour cette v1. Reste noté pour un travail ultérieur avec Qara Pulse (hors v1, section 1) : politique de rétention définitive des preuves et classification réglementaire formelle.
