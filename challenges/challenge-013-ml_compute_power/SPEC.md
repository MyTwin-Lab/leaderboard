# Challenge 014 – Puissance de calcul pour les challenges ML

## 1. Contexte & objectifs

- **Problème identifié** : sur un challenge ML, un contributeur qui veut entraîner un modèle doit le faire avec ses propres moyens (sa machine, son propre compte cloud). Il n'y a aujourd'hui aucun moyen, depuis la plateforme, de lui donner accès à de la puissance de calcul pour faire ce travail.
- **Objectif** : permettre à un contributeur, depuis un challenge de type ML, de demander l'accès temporaire à une instance de calcul (hébergée chez Scaleway), validée par le manager du challenge, pour y entraîner son modèle.
- **Valeur attendue** :
  - Réduit la barrière à l'entrée pour les contributeurs qui n'ont pas de machine ou de budget cloud personnel adaptés à l'entraînement d'un modèle.
  - Garde la main de l'entreprise sur le coût et l'usage : rien n'est automatique, chaque demande passe par une validation humaine (le manager du challenge) et la ressource est bornée dans le temps.
  - S'intègre naturellement au parcours ML existant : le contributeur reste dans son flow habituel (entraîner → publier son modèle sur Kaggle → soumettre l'URL dans le ML workspace) ; l'instance n'est qu'un outil de travail temporaire, pas un nouveau livrable à gérer.

## 2. Portée

Concerne uniquement les challenges de type **ML** (pas les challenges "code", ni les challenges "validation").

Inclus dans ce challenge :
1. Un moyen pour un admin de connecter un compte/token Scaleway à la plateforme, pour que celle-ci puisse créer des instances en son nom.
2. Un bouton, côté contributeur, pour demander de la puissance de calcul sur un challenge ML auquel il participe.
3. Un écran côté manager du challenge pour voir les demandes en attente et les approuver ou les refuser.
4. La création effective d'une instance de calcul une fois la demande approuvée, et sa mise à disposition du contributeur sous forme d'un environnement de travail accessible depuis le navigateur.
5. La coupure automatique de l'instance 24h après son approbation.

Explicitement **hors périmètre** de ce challenge (voir aussi section 8) :
- Le choix, par le manager ou le contributeur, du type/de la taille de l'instance (une seule offre fixe pour tous en v1).
- Toute notion de coût ou de budget en Contribution Points : l'usage est pris en charge par l'entreprise, sans impact sur les pools CP existants.
- Toute prolongation, mise en pause, ou extension de la durée de 24h.
- La récupération automatisée des résultats d'entraînement par la plateforme : le contributeur reste responsable de publier son modèle comme il le fait déjà aujourd'hui (ex. sur Kaggle) avant l'expiration de l'instance.

## 3. Acteurs & permissions

| Acteur | Ce qu'il peut faire |
|---|---|
| **Contributeur** membre d'un challenge ML | Demander de la puissance de calcul (une seule fois par challenge). Voir le statut de sa demande. Une fois approuvée, accéder à son environnement de travail. |
| **Manager** du challenge (ou admin) | Voir toutes les demandes de puissance de calcul faites sur ce challenge. Approuver ou refuser une demande. |
| **Admin** (profil admin) | Connecter/déconnecter le compte Scaleway utilisé par la plateforme pour créer les instances. Voit et peut agir sur les demandes de tous les challenges, comme tout manager. |

Un contributeur qui n'est pas membre du challenge, ou un challenge qui n'est pas de type ML, ne voient pas cette fonctionnalité.

## 4. Flux fonctionnel détaillé

### 4.1 Connexion du service (préalable, côté admin)

1. Dans son profil, l'admin ouvre l'onglet où sont gérées les intégrations externes (celui qui contient déjà les connexions GitHub, Kaggle, Slack, OpenAI).
2. Il y trouve une nouvelle carte "Scaleway". Il colle les identifiants nécessaires (un jeton d'accès à son compte Scaleway).
3. La plateforme vérifie que ce jeton fonctionne réellement avant de l'enregistrer, puis le garde de façon sécurisée.
4. Tant que ce service n'est pas connecté, la fonctionnalité de demande de puissance de calcul reste invisible ou désactivée pour les contributeurs et les managers, avec un message clair expliquant pourquoi.
5. L'admin peut déconnecter le compte à tout moment ; les demandes déjà en cours à ce moment-là sont un cas limite à traiter (voir section 7).

### 4.2 Demande de puissance de calcul (côté contributeur)

1. Sur un challenge de type ML dont il est membre, le contributeur voit, dans l'espace où il gère ses soumissions (le "ML workspace"), un bouton "Demander de la puissance de calcul".
2. En cliquant, il confirme sa demande (un court texte rappelle les règles : 1 seule demande possible sur ce challenge, disponible 24h une fois validée, coupure automatique passé ce délai).
3. Une fois la demande envoyée, le bouton est remplacé par un badge de statut : **"En attente de validation"**.
4. Le contributeur ne peut plus refaire de demande sur ce même challenge, quelle que soit l'issue de la première (validée, refusée, ou expirée) — un seul essai par challenge.

### 4.3 Traitement de la demande (côté manager)

1. Le manager du challenge (ou un admin) voit, dans sa vue de gestion du challenge, un nouvel onglet dédié listant les demandes de puissance de calcul reçues sur ce challenge : qui a demandé, quand, et le statut actuel.
2. Pour chaque demande en attente, il peut cliquer **Approuver** ou **Refuser**.
3. S'il refuse, le contributeur voit son badge passer à **"Refusée"** ; l'histoire s'arrête là pour ce challenge (pas de nouvelle tentative possible).
4. S'il approuve, la création de l'instance démarre (voir 4.4) et le manager voit le statut évoluer en direct dans son onglet (ex. "Approuvée — création en cours" puis "Active — expire à [heure]").

### 4.4 Mise à disposition de l'instance

1. Une fois approuvée, la plateforme crée automatiquement une instance de calcul chez Scaleway, pré-configurée avec un environnement de travail interactif (type notebook) accessible directement depuis un navigateur — pas d'installation ni de configuration technique requise côté contributeur.
2. Pendant la création (qui peut prendre quelques instants à quelques minutes), le contributeur voit un statut **"Préparation de votre environnement..."**.
3. Une fois prête, le badge du contributeur devient **"Disponible — expire dans XhYY"** avec un bouton **"Ouvrir mon environnement"** qui l'amène directement dans son notebook, où il peut télécharger son dataset, entraîner son modèle, et récupérer les résultats (ex. en les publiant sur Kaggle, comme il le fait déjà pour toute soumission de modèle).
4. Le compte à rebours démarre au moment où la demande est **approuvée** par le manager, pas au moment où le contributeur ouvre effectivement son environnement pour la première fois.

**Contenu de l'environnement** : le notebook fourni est volontairement quasi nu — seuls les drivers GPU et un environnement Python/Jupyter fonctionnels sont préinstallés, aucune librairie ML (PyTorch, TensorFlow, etc.) n'est imposée. Choix assumé : configurer des drivers GPU/CUDA est une étape technique pénible et sans rapport avec le travail du contributeur, alors que l'installation d'une librairie ML via `pip` est rapide — inutile de faire perdre du temps sur la partie infrastructure alors que les 24h ne sont pas prolongeables.

**Accès aux datasets Kaggle** : l'instance n'embarque aucun credential Kaggle par défaut. Si le contributeur veut télécharger son dataset via l'API Kaggle, il saisit sa propre clé API dans le notebook, comme il le ferait sur n'importe quel environnement personnel. Le credential Kaggle partagé de l'application (celui connecté par l'admin, utilisé ailleurs pour lire les métadonnées de datasets/modèles) n'est délibérément pas placé dans l'instance : une fois dans un environnement que le contributeur contrôle, il y aurait un accès technique complet, ce qui est jugé trop risqué pour un credential partagé par toute l'application.

**Protection de l'accès** : chaque instance est protégée par un jeton d'accès unique, généré à la création et affiché une seule fois au contributeur (dans son badge de statut, à côté du bouton "Ouvrir mon environnement"). Le manager ne voit que le statut de la demande, jamais ce jeton — lui seul (le contributeur) peut ouvrir son environnement.

### 4.5 Expiration

1. 24h après l'approbation, l'instance est coupée automatiquement, **sans exception** — même si un entraînement est toujours en cours au moment de la coupure. Ce comportement simple est un choix assumé pour cette première version ; il pourra être affiné plus tard (ex. avertissement avant coupure, prolongation possible).
2. Le badge du contributeur passe à **"Expirée"**. Il perd l'accès à son environnement de travail, et ne peut pas en redemander un nouveau sur ce même challenge.
3. Le manager voit le même statut "Expirée" dans son onglet de suivi.

## 5. Règles & contraintes

- Une seule demande possible par contributeur et par challenge ML — pas de renouvellement, pas de deuxième chance après un refus ou une expiration.
- Une seule instance active à la fois par demande (pas de notion de plusieurs instances pour un même contributeur sur un même challenge).
- Durée fixe et non négociable en v1 : 24h à partir de l'approbation, coupure automatique et systématique.
- Un seul type/gabarit d'instance proposé pour toutes les demandes en v1 — pas de choix de puissance, de taille ou de configuration. Cible visée : une instance GPU avec 16 Go de VRAM (modèle de GPU exact encore à confirmer, voir section 9).
- Aucun coût en Contribution Points : cette fonctionnalité n'interagit ni avec le pool CP du challenge ML, ni avec aucun autre système de récompense existant.
- La fonctionnalité n'existe que pour les challenges de type ML ; elle est totalement absente des challenges "code" et "validation".

## 6. États d'une demande

```
(aucune demande) → En attente de validation → Refusée [fin]
                                             → Approuvée → Préparation en cours → Disponible (jusqu'à expiration) → Expirée [fin]
```

À tout moment, un contributeur n'a qu'une seule demande active sur un challenge donné, et cette demande suit cette progression sans retour en arrière possible.

## 7. Cas limites à couvrir

- **Le service Scaleway n'est pas connecté par l'admin** au moment où un contributeur voudrait faire une demande : le bouton de demande est masqué ou désactivé, avec une explication.
- **Le service Scaleway est déconnecté par l'admin pendant qu'une instance est active** : à définir précisément en conception détaillée, mais le comportement par défaut attendu est que l'instance déjà créée continue de vivre jusqu'à son expiration naturelle ; seules les nouvelles approbations sont bloquées.
- **La création de l'instance échoue** techniquement après approbation (ex. quota Scaleway atteint, erreur d'API) : le contributeur et le manager voient un statut d'échec clair, distinct de "Refusée" (qui est une décision humaine) — à formuler par exemple "Échec de la création, contactez un admin".
- **Le manager quitte son rôle ou le challenge change de manager** en cours de route : les demandes déjà traitées gardent leur historique (qui a approuvé/refusé), les nouvelles demandes sont visibles par le manager courant.
- **Le challenge est clôturé ou supprimé** alors qu'une instance est encore active : l'instance est coupée immédiatement à la clôture, indépendamment du délai de 24h restant. Le badge du contributeur passe directement à "Expirée".

## 8. Hors périmètre / Limites connues (v1)

- Pas de choix du type d'instance (CPU/GPU, taille) — un seul gabarit fixe pour tout le monde. Un choix multiple pourra être ajouté plus tard.
- Pas de prolongation ni de pause de la durée de 24h.
- Pas de suivi ou de facturation détaillée du coût réel par demande/challenge/contributeur.
- Pas de sauvegarde automatique du travail du contributeur avant coupure : c'est à lui de récupérer ce dont il a besoin avant l'expiration.
- Pas de vue globale admin "toutes les demandes, tous challenges confondus" en v1 — seulement la vue par challenge, côté manager.

## 9. Questions ouvertes

- Quel modèle de GPU Scaleway précis servira à atteindre les 16 Go de VRAM visés ? Aucune offre actuelle du catalogue Scaleway (L4 24 Go, L40S 48 Go, H100 80 Go, B300) ne tombe exactement sur 16 Go. Scaleway a eu par le passé une instance à ce gabarit précis (RENDER-S, GPU Tesla P100 16 Go), mais elle n'apparaît plus dans l'offre actuelle et semble retirée du catalogue — à vérifier directement auprès de Scaleway avant de trancher. À défaut, l'option la plus proche au-dessus de la cible est le palier L4 (24 Go, single-GPU), qui est aussi le palier GPU le moins cher du catalogue actuel.
- Faut-il prévenir le contributeur un peu avant la coupure à 24h (ex. notification "il vous reste 1h") ? Explicitement exclu du périmètre v1, mais à garder en tête comme amélioration probable.
