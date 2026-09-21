# MyTwin Lab News — briefs de la première fournée

**Date :** 2026-09-16
**Statut :** ✅ **les 9 news sont rédigées**, dans `apps/leaderboard-client/src/content/news/`. Ce document garde les briefs tels que validés ; ce qui est en ligne, c'est le code. Règles appliquées : [`news-playbook.md`](../news-playbook.md).

**Réponses reçues le 2026-09-16, appliquées :** mammographie datée de juillet 2026, contributeurs nommés « Alix » et « Hedi » · blessures de référence du benchmark tennis = blessures recensées dans la presse · produit i-Virtual dans MyTwin = Saphere, avec son score de santé cardiovasculaire · Skinive dans MyTwin = probabilités de types de lésion, risque associé, accès simplifié à un dermatologue (aucun diagnostic par l'application) · Ensweet et HealthGuard publiés maintenant, à partir des épisodes · MyKine : lien vers la fiche Sandbox uniquement. Les décisions qui en découlent sont dans le journal du playbook.

Chaque brief donne l'angle, le plan, les liens et les garde-fous. Les sources citées ont toutes été ouvertes et vérifiées (pages officielles, EUDAMED, PubMed / PMC) ; les URLs complètes sont reprises au moment de la rédaction. Ce qui bloque la rédaction est marqué ❓.

Ordre d'affichage (mois de l'événement, du plus récent au plus ancien) :

| # | Slug | Catégorie | Mois | Statut |
|---|---|---|---|---|
| 1 | `mykine` | sandbox | 2026-09 | rédigée |
| 2 | `mytwin-lab-leaderboard-beta` | community | 2026-08 | retirée le 2026-09-22 |
| 3 | `mammography-ai-challenges` | challenge | 2026-07 | rédigée |
| 4 | `healthguard-patient-controlled-records` | partnership | 2026-07 | rédigée |
| 5 | `ensweet-cardiac-rehabilitation` | partnership | 2026-06 | rédigée |
| 6 | `racket-sports-injury-risk` | research | 2025-08 | rédigée |
| 7 | `virtuosis-ai-voice-analysis` | partnership | 2025-05 | rédigée |
| 8 | `skinive-ai-skin-checks` | partnership | 2025-05 | rédigée |
| 9 | `i-virtual-camera-vital-signs` | partnership | 2025-04 | rédigée |

---

## 1. MyKine — séances de kiné guidées, posture estimée sur le téléphone

- **H1 :** MyKine: guided physiotherapy sessions with on-device pose estimation
- **seoTitle :** MyKine: home physio sessions with pose estimation
- **Requêtes :** « MyKine », « physiotherapy exercise app pose estimation », « home exercise adherence app »
- **Angle.** Le kiné prescrit des exercices à faire chez soi et ne sait jamais ce qui s'est passé. MyKine part de là : le seul capteur que chaque patient possède déjà, la caméra du téléphone, compte les répétitions et mesure les angles, **sans qu'aucune image ne quitte l'appareil**. Un projet proposé par Alix Chagot dans la Sandbox en septembre 2026, au stade de démo web.
- **Plan.**
  1. *The gap between the session and the living room* — adhérence : jusqu'à 70 % de non-adhérence aux exercices à domicile (Essery et al., 2017, revue systématique) ; l'adhérence est mal mesurée, seuls 40,9 % des essais la rapportent (Smith et al., 2023). Besoin : 1,71 milliard de personnes avec une affection musculo-squelettique (OMS), 2,4 milliards pourraient bénéficier de rééducation (OMS).
  2. *How it works* — MediaPipe Pose Landmarker (33 points du corps, sur l'appareil) ; score déterministe par seuils d'angle, « pas de boîte noire » ; replay en squelette, aucune vidéo stockée ; bibliothèque d'exercices extensible par un kiné sans code.
  3. *What it deliberately doesn't do* — affiche des mesures, ne donne pas de consigne corrective : c'est ce qui le garde hors du périmètre dispositif médical (un logiciel qui *recommande* des exercices de rééducation personnalisés en est un, MDCG 2019-11). Limites : la précision des angles par estimation de posture n'est pas encore de niveau clinique (Wade et al., 2022 ; Lam et al., 2023), et les seuils n'ont pas encore été relus par un kiné.
  4. *What would make it a challenge* — les étoiles de la Sandbox, et la relecture par des kinés.
- **At a glance :** When · September 2026 / Stage · Sandbox proposal, web demo / Who · Alix Chagot / Tech · MediaPipe Pose Landmarker, on-device / Privacy · no image leaves the device.
- **Bloc visuel.** Un squelette en SVG (les points du corps) sur un mouvement simple, avec l'arc de l'angle mesuré, et la chaîne *caméra → modèle sur l'appareil → angles et répétitions → résumé de séance*, la vidéo barrée à la sortie du téléphone. Aucun chiffre.
- **Liens.** Lab : fiche Sandbox (lead + CTA) · mytwin.care : `real-world-data-patient-monitoring` (suivre les patients entre deux consultations) · Techno : doc MediaPipe · Sources : Essery 2017, Smith 2023, Wade 2022, Lam 2023, OMS ×2, MDCG 2019-11.
- **CTA.** « Star MyKine in the Sandbox » → fiche Sandbox (0 étoile aujourd'hui : les étoiles sont le seul moyen de le faire avancer, la collaboration s'ouvre à la promotion).
- **Garde-fous.** Ni « open source » (le repo n'a pas de licence), ni « app » (démo web), ni « améliore la rééducation » (aucune preuve à ce jour).
- ❓ **Accord d'Alix** pour être nommé. Le repo s'appelle « MyCoach — démo patient » : on le lie, ou seulement la fiche Sandbox ? Une licence est-elle prévue ?

## 2. Le Leaderboard du Lab — du prototype à la bêta

- **H1 :** The MyTwin Lab Leaderboard: from a first prototype to a public beta
- **seoTitle :** MyTwin Lab Leaderboard: from prototype to beta
- **Requêtes :** « MyTwin Lab Leaderboard » (l'`alternateName` du site), « health innovation contribution points ». Ne titre **pas** sur « MyTwin Lab », qui appartient à l'accueil et à `/about`.
- **Angle.** Le récit de l'outil : premier prototype en juin 2025, bêta publique en août 2026. Ce qu'il change : toute contribution à un projet santé (code, dataset, modèle, validation clinique, discussion) est suivie, évaluée sur une grille publiée et créditée en CP ; la Sandbox laisse chacun proposer son projet.
- **Plan.** *Why a leaderboard for health innovation* · *How a contribution becomes CP* (challenges code, ML, validation ; évaluation par IA sur grille publiée, revue humaine possible ; GPU sur demande) · *The Sandbox: propose, star, promote* · *What the beta means* (ce qui marche, ce qui vient).
- **At a glance :** First prototype · June 2025 / Public beta · August 2026 / Challenge types · code, machine learning, validation / Rewards · contribution points (CP), no monetary value.
- **Bloc visuel.** La boucle de contribution : *choisir un challenge → contribuer → évaluation sur grille publiée → CP → classement*, avec la bretelle *Sandbox → étoiles → promotion en challenge*.
- **Liens.** `/about`, `/challenges`, `/sandbox`, `/leaderboard`, GitHub MyTwin-Lab, la politique de confidentialité (§ évaluation automatisée) · mytwin.care : accueil.
- **CTA.** « Explore the challenges » → `/challenges`.
- **Garde-fous.** Les CP n'ont aucune valeur monétaire : le dire. Pas de chiffres de communauté figés dans le texte (ils bougent tous les jours).
- ❓ Le premier commit de ce repo date d'octobre 2025 : le prototype de juin 2025 vivait-il ailleurs ? Juste pour raconter juste.

## 3. Mammographie — deux challenges ouverts, et une vision

- **H1 :** Two open challenges toward an AI second opinion on mammograms
- **seoTitle :** Mammography AI: two open challenges at MyTwin Lab
- **Requêtes :** « open mammography AI challenge », « mammogram AI second opinion ». Ne titre **pas** sur « AI in medical imaging » (article mytwin.care, lié).
- **Angle.** Deux challenges complémentaires : la classification dit *qu'*il y a quelque chose de suspect, la segmentation dit *où*. Des modèles open source, entraînés uniquement sur des données publiques. Derrière, la vision de MyTwin : rendre un second avis par IA sur une mammographie accessible gratuitement, via l'application MyTwin for Patients, à toutes les femmes et aux déserts médicaux ; puis licencier la technologie aux hôpitaux qui traitent de gros volumes.
- **Plan.**
  1. *Two challenges, one question* — tâches, métriques (AUC / Dice-IoU), données de base (CBIS-DDSM et ses masques), livrables (dataset, modèle, code, API).
  2. *Why it matters* — 2,4 millions de femmes diagnostiquées et 694 000 décès en 2024 (OMS) ; en 2050, 3,2 millions de cas par an, surtout dans les pays à faible IDH (CIRC). Radiologues : ~1 à 2 par million d'habitants dans les pays à faible revenu contre ~95 dans les pays à haut revenu (Lancet Oncology Commission, 2021) ; au Royaume-Uni, 32 % de radiologues consultants manquants (RCR, 2025).
  3. *What the evidence says* — MASAI (essai randomisé suédois : plus de cancers détectés sans plus de faux positifs, charge de lecture −44 %, cancers d'intervalle non inférieurs) et PRAIM (Allemagne, 463 094 femmes, +17,6 % de détection). **Toujours avec des radiologues qui lisent.** Et l'humilité : au challenge RSNA 2023, la sensibilité médiane de 1 537 algorithmes ouverts était de 27,6 % (Chen et al., Radiology 2025).
  4. *The vision, and the road to it* — second avis gratuit dans MyTwin for Patients, licences hôpitaux. Le chemin : challenges → validation clinique → marquage CE comme dispositif médical (un logiciel d'aide au diagnostic du cancer sur image peut relever de la classe III, MDCG 2019-11) → mise à disposition. Rien de tout cela n'est disponible aujourd'hui.
- **At a glance :** When ❓ / Stage · open challenges, research / Tasks · classification (AUC), segmentation (Dice, IoU) / Data · public datasets only, baseline CBIS-DDSM / Next · clinical validation.
- **Bloc visuel.** Deux cartes « *that* / *where* » (une mammographie stylisée : un badge d'un côté, un contour de l'autre), puis la frise *challenge → validation clinique → certification → MyTwin for Patients / licences hôpitaux*, l'étape actuelle allumée.
- **Liens.** Lab : les deux challenges · mytwin.care : `ai-medical-imaging` (les cinq conditions de confiance) et `second-medical-opinion` · Sources : OMS, CIRC/GLOBOCAN, Lancet Oncology Commission, RCR, MASAI (×3), PRAIM, Chen 2025, MDCG 2019-11, CBIS-DDSM.
- **CTA.** « Join the segmentation challenge » (0 participant aujourd'hui, pool 16 000 CP).
- **Garde-fous.** « Second avis » = une information pour la patiente et son médecin, jamais un diagnostic. Pas de performance des modèles du Lab tant qu'elle n'est pas validée.
- ❓ **Dates** : tu m'as dit juillet 2026, mais la fiche classification indique 21 août → 21 septembre 2026 (premières contributions le 5 août) et la segmentation n'a pas de dates. Quel mois retenir ?
- ❓ **Licences des données — point business important.** Pour licencier la technologie aux hôpitaux, les modèles doivent être entraînés sur des données qui l'autorisent. CBIS-DDSM (CC BY 3.0) et CMMD (CC BY 4.0) le permettent ; RSNA (usage non commercial uniquement) et VinDr-Mammo (recherche uniquement, accord signé) non. Le brief du challenge dit « public datasets » sans restreindre la licence : à préciser dans les challenges avant que des modèles soient entraînés dessus.
- ❓ Nomme-t-on les contributeurs (Alix Chagot, toi) ?

## 4. HealthGuard — un dossier médical dont le patient détient les accès

- **H1 :** HealthGuard: a hospital pharmacist's project to give patients control of their medical records
- **seoTitle :** HealthGuard: patient-controlled medical records
- **Requêtes :** « HealthGuard medical records », « patient-controlled health records ». Ne titre **pas** sur « personal health record » (article mytwin.care, lié).
- **Angle.** Sébastien Saliques, **pharmacien hospitalier** (et non médecin : c'est ainsi qu'il se présente, et le registre RPPS le confirme), construit HealthGuard depuis deux à trois ans : on ne partage plus un document, on partage un **accès**, tracé et révocable. Invité de MyTwin Inside en juillet 2026 ; il souhaite rejoindre le Lab pour accélérer.
- **Plan.** *Information missing at the wrong moment* (erreurs dans les dossiers : 21 % des patients lisant leurs notes y voient une erreur, Bell et al., JAMA Netw Open 2020 ; historiques médicamenteux erronés jusqu'à 67 %, Tam et al., CMAJ 2005 ; OMS sur les transitions de soins) · *Share access, not documents* (chiffrement, stockage décentralisé IPFS, la blockchain ne porte que les permissions, jamais un document) · *Where it stands* (version alpha, pas encore disponible) · *Why it fits MyTwin* (le dossier réuni en un seul endroit ; l'espace européen des données de santé donne aux patients l'accès à leurs données).
- **At a glance :** When · July 2026 (MyTwin Inside) / Who · Sébastien Saliques, hospital pharmacist / Stage · alpha / Principle · traced, revocable access.
- **Bloc visuel.** « Document partagé » vs « accès partagé » : à gauche une copie qui circule, à droite une clé d'accès avec durée, journal et bouton de révocation.
- **Épisode intégré :** `I9Mw6CTHXZo`.
- **Liens.** healthguard-project.com · mytwin.care : `personal-health-record` et la story de Kevin · Sources : Bell 2020, Tam 2005, OMS 2019, Commission européenne (EHDS).
- **CTA.** « Watch the episode » n'est pas une action du Lab : je propose « Discover how MyTwin brings your records together » → mytwin.care patients.
- **Garde-fous.** Ne jamais présenter HealthGuard comme disponible ni conforme : aucune certification HDS ni analyse RGPD n'est publique. Les affirmations du fondateur (« impossible à rançonner ») lui sont attribuées ou écartées.
- ❓ **Son accord**, et le cadre : rejoint-il le Lab (projet Sandbox ?) ou reste-t-on sur « MyTwin souhaite intégrer sa technologie » ? Dans le premier cas, la news gagne à attendre l'événement.

## 5. Ensweet — la réadaptation cardiaque continue à la maison

- **H1 :** Ensweet and MyTwin: keeping cardiac rehabilitation going at home
- **seoTitle :** Ensweet x MyTwin: cardiac rehabilitation at home
- **Requêtes :** « Ensweet », « cardiac tele-rehabilitation ». Ne titre **pas** sur « workplace heart health » (article mytwin.care).
- **Angle.** Après un infarctus, la réadaptation cardiaque est recommandée à tous (ESC 2023, classe I, niveau A), réduit les récidives et les hospitalisations (Cochrane 2021), et pourtant peu de patients en bénéficient : 34,4 % se la voient proposer, 19,6 % suivent au moins la moitié des séances (INTERASPIRE, 2025). Ensweet propose une téléréadaptation hybride, supervisée par l'équipe du centre. Son offre post-réadaptation doit être disponible « notamment sur MyTwin », a annoncé Valentine Antoine (Chief of Staff) dans MyTwin Inside en juin 2026.
- **Plan.** *The gap after the hospital* · *How Ensweet's tele-rehabilitation works* (vélo et capteur cardiaque livrés, séances suivies à distance, alertes de seuil fixées par l'équipe ; expérimentations article 51 dans 23 établissements) · *What home-based rehabilitation is worth* (aussi efficace qu'en centre selon Cochrane 2023, preuve de faible certitude) · *What comes next with MyTwin*.
- **At a glance :** When · June 2026 / Stage · in discussion / Who · Ensweet (Lille) / Regulatory · class I medical device (EUDAMED).
- **Épisode intégré :** `VsQTq4K1Jb8`.
- **Liens.** ensweet.fr · mytwin.care : clinicians · Sources : ESC 2023, Cochrane 2021 et 2023, INTERASPIRE 2025, EUDAMED.
- **CTA.** « Discover MyTwin for clinicians ».
- **Garde-fous.** Les chiffres d'Ensweet (adhérence ~80 %, 3 500 patients) ne sont publiés nulle part : attribués ou écartés. Le « 25 % de mortalité en moins » n'a pas de source citée dans l'épisode : remplacé par Cochrane.
- ❓ **Accord d'Ensweet** : « en discussion » n'est pas encore un événement public, sauf ce que Valentine Antoine a dit à l'antenne. On publie maintenant sur cette base, ou à la signature ?

## 6. Blessures en sports de raquette — **rédigée** (pilote)

Voir `/news/racket-sports-injury-risk`.
- ❓ **Qu'est-ce qui comptait comme « blessure »** dans les données du benchmark : blessures médicalement confirmées, ou abandons et forfaits tirés des résultats de matchs (seule donnée publique à cette échelle sur le tennis pro) ? Si ce sont des abandons, l'article doit le dire.
- ❓ Le prototype couvre-t-il déjà padel et pickleball, ou seulement le tennis ? (La news dit : benchmark sur le tennis pro uniquement.)

## 7. Virtuosis AI — la voix comme source de signaux

- **H1 :** Virtuosis AI brings voice analysis to MyTwin
- **seoTitle :** Virtuosis AI x MyTwin: voice analysis in pilot
- **Requêtes :** « Virtuosis AI », « voice biomarkers stress anxiety app ».
- **Angle.** Depuis mai 2025, MyTwin intègre en pilote, dans sa bêta privée, l'analyse vocale de Virtuosis AI (spin-off de l'EPFL, cofondée par Lara Gervaise et Edoardo Giudice) : trente à quarante secondes de parole, dont on analyse la *manière* et non le *sens*, donnent des signaux associés au stress, à l'anxiété et à l'humeur dépressive.
- **Plan.** *What your voice carries* (hauteur, débit, qualité de voix, rythme) · *What MyTwin shows* ❓ · *What the evidence says* (méta-analyse de 105 études sur la dépression : prometteur, « à considérer comme une méthode complémentaire », Maran et al., JMIR Ment Health 2025 ; résultats de Virtuosis publiés en résumés de congrès, présentés comme tels) · *Status* (dispositif médical de classe I enregistré dans EUDAMED, fabricant Virtuosis Health).
- **At a glance :** When · May 2025 / Stage · pilot, MyTwin private beta / Who · Virtuosis AI (Lausanne) / Input · ~30 seconds of speech.
- **Épisode intégré :** `LA_vw_gmANM` (Lara Gervaise).
- **Liens.** virtuosis.ai · news pilote tennis (santé mentale des athlètes) · mytwin.care : patients · Sources : Maran 2025, Low 2020, EUDAMED, page de validation Virtuosis.
- **CTA.** « Discover MyTwin for patients ».
- **Garde-fous.** Jamais « détecte la dépression / Alzheimer » (même si le titre YouTube le dit). Pas de « certifié » pour une classe I.
- ❓ **Ce que MyTwin affiche** : stress, anxiété, dépression en faible / modéré / élevé ? Le bouton pour joindre un professionnel après un résultat est-il en place ?

## 8. Skinive — un premier regard sur la peau

- **H1 :** Skinive brings AI skin checks to MyTwin
- **seoTitle :** Skinive x MyTwin: AI skin checks in pilot
- **Requêtes :** « Skinive », « AI skin check app ».
- **Angle.** Depuis mai 2025, en pilote dans la bêta privée : une photo d'une lésion ou d'une zone de peau, une évaluation parmi 55+ affections, et une orientation vers un dermatologue quand il le faut. Un premier regard quand le rendez-vous est à des mois, comme pour Cindy.
- **Plan.** *When the dermatologist is months away* (1,5 million de cancers de la peau en 2020, OMS ; mélanome +50 % de cas d'ici 2040, CIRC ; la story de Cindy) · *What Skinive does in MyTwin* ❓ · *What it is not* (« not a diagnostic tool », selon Skinive ; dispositif médical de classe I, EUDAMED) · *The limits we keep in mind* (les applis ne peuvent pas détecter tous les cancers de la peau, BMJ 2020 ; peaux foncées sous-représentées dans les jeux de données, Lancet Digit Health 2022 ; études de Skinive écrites par l'entreprise).
- **At a glance :** When · May 2025 / Stage · pilot, MyTwin private beta / Who · Skinive / Input · a photo of the skin.
- **Liens.** skinive.com · mytwin.care : story de Cindy · Sources : OMS, CIRC, Freeman BMJ 2020, Wen 2022, EUDAMED, conditions de Skinive.
- **CTA.** « Discover MyTwin for patients ».
- **Garde-fous.** Présenter la limite BMJ n'est pas desservir le partenaire, c'est ce qui rend la news crédible sur un sujet YMYL. À assumer, ou à discuter avec Skinive.
- ❓ **Le parcours dans MyTwin** : que voit l'utilisateur après la photo, et y a-t-il une mise en relation avec un dermatologue ?

## 9. i-Virtual — des signes vitaux mesurés sur une vidéo du visage

- **H1 :** i-Virtual brings camera-based vital signs to MyTwin
- **seoTitle :** i-Virtual x MyTwin: vital signs from a video
- **Requêtes :** « i-Virtual », « vital signs from selfie video », « rPPG ».
- **Angle.** Depuis avril 2025, en pilote : un selfie vidéo de 30 secondes, la lumière réfléchie par le front, l'onde de pouls reconstruite (photopléthysmographie à distance). Le principe d'un oxymètre de pouls, sans rien toucher.
- **Plan.** *How a camera sees your pulse* · *What is measured, and what is medical* (Caducy est enregistré comme dispositif médical de classe IIa pour la fréquence cardiaque et la fréquence respiratoire ; la variabilité cardiaque et le stress sont donnés « not for medical purposes », selon sa notice) · *What the studies show* (963 patients au CHRU de Nancy, études financées par i-Virtual, Allado et al., 2022 ; revues : précision correcte au repos, études souvent petites, Pham 2022 ; biais selon les populations, Dasari 2021) · *Limits* (mesure ponctuelle, au repos, bonne lumière ; notice : contre-indiqué pour les phototypes 5 et 6).
- **At a glance :** When · April 2025 / Stage · pilot, MyTwin private beta / Who · i-Virtual (Metz) / Input · a 30-second selfie video.
- **Épisode intégré :** `NPmsdN1KAV0` (Benoît Georis, CEO).
- **Liens.** i-virtual.ai · mytwin.care : `remote-patient-monitoring` · Sources : OMS maladies cardiovasculaires, notice Caducy, EUDAMED, Allado 2022, Pham 2022, Dasari 2021.
- **CTA.** « Discover MyTwin for clinicians ».
- **Garde-fous.** La contre-indication pour les peaux les plus foncées doit apparaître : on ne peut pas la taire sur un sujet santé. Pas de « prédit l'AVC » (le CEO lui-même le dit à des années).
- ❓ **Quel produit tourne dans MyTwin**, Caducy (dispositif médical) ou Saphere (bien-être, avec « hypertension risk ») ? Et le « score de santé cardiovasculaire » évoqué dans l'épisode : d'où vient-il ?

---

## Points transverses

- **Consentement.** Chaque personne et chaque partenaire nommés valident avant publication (playbook §6.7). Les trois partenaires en pilote peuvent aussi relire leur paragraphe « statut ».
- **Date de publication.** `publishedAt` sera fixé au jour du déploiement (la pilote porte le 2026-09-16 d'ici là).
- **Liens retour.** À la publication, demander à chaque partenaire un lien vers sa news depuis son site.
