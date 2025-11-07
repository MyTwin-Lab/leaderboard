# 🗺️ Roadmap – Intégration sélection de dossier Google Drive

## 1. Préparatifs
- Créer le client OAuth Google (type « Application Web ») et configurer les origines/redirects `localhost`.
- Activer les APIs « Google Drive » et « Google Picker » dans le projet GCP.
- Documenter les variables nécessaires (`GOOGLE_CLIENT_ID`, `GOOGLE_SCOPES`, etc.) pour le front.

## 2. Frontend admin (`apps/admin`)
1. **Chargement des scripts Google**
   - Ajouter `https://accounts.google.com/gsi/client` et `https://apis.google.com/js/api.js` dans `index.html` avec une initialisation contrôlée.
2. **Flux OAuth léger**
   - Implémenter une fonction d’initialisation GIS pour déclencher le picker et récupérer un access token à usage unique.
   - Gérer l’état d’auth Google côté front (token en mémoire seulement, pas de persistance).
3. **UI de sélection de dossier**
   - Ajouter un bouton « Sélectionner un dossier Drive » sur l’écran dédié (tab Sync/challenge).
   - Afficher l’ID et le nom du dossier sélectionné, avec possibilité de re-sélection.
4. **Intégration API**
   - Réutiliser les helpers `apiPost`/`apiPut` pour envoyer l’ID de dossier au backend en conservant la Basic Auth.
   - Ajouter une gestion d’erreur claire si la sélection ou l’enregistrement échoue.

## 3. API backend (`packages/api`)
1. **Modèle & persistance**
   - Étendre la structure Challenge/Sync pour stocker `drive_folder_id` (et métadonnées si besoin).
   - Mettre à jour le repository concerné pour lire/écrire ce champ.
2. **Routes protégées**
   - Ajouter un endpoint admin (`POST /api/challenges/:id/drive-folder` ou équivalent) protégé par `requireAdmin` pour enregistrer/mettre à jour le dossier.
   - Adapter les réponses des endpoints existants (context challenge, sync run) pour exposer l’ID sélectionné.
3. **Validation & sécurité**
   - Valider le format de l’ID reçu avant persistance.
   - Journaliser les opérations d’association de dossier pour suivre les actions admin.

## 4. Harmonisation & documentation
- Mettre à jour la documentation interne de l’admin (README) sur l’usage du bouton et la configuration OAuth.
- Décrire la procédure de configuration locale (variables d’environnement, limites Google en mode test).
- Planifier une revue post-déploiement pour confirmer que la sélection de dossier fonctionne sur les différents environnements.