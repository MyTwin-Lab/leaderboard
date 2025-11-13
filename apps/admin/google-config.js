/**
 * Configuration Google Identity Services / Picker pour le backoffice admin.
 *
 * ⚠️ Remplacez les valeurs par celles de votre projet GCP :
 *   - clientId : ID client OAuth 2.0 (type "Application Web")
 *   - apiKey   : Clé API REST (nécessaire pour Google Picker)
 *   - scopes   : Liste des scopes nécessaires (Drive metadata en lecture)
 */
window.googleIntegrationConfig = {
  clientId: "145041414481-q7d6ii9a0tqpdblunfee5g8dtc3luooj.apps.googleusercontent.com",
  apiKey: "AIzaSyCSjHUxv8T7eB2tjoYGCjNoLu5ICUA9-mM",
  scopes: [
    "https://www.googleapis.com/auth/drive.metadata.readonly"
  ],
  pickerLocale: "fr"
};
