(function () {
  const config = window.googleIntegrationConfig;

  if (!config) {
    console.warn("Google integration config non définie. Assurez-vous de charger google-config.js avant google-drive.js.");
    return;
  }

  let tokenClient = null;
  let accessToken = null;
  let pickerInitialized = false;
  let pickerLoadingPromise = null;

  function ensureConfigValue(value, placeholderPrefix) {
    return value && !String(value).startsWith(placeholderPrefix);
  }

  function ensureTokenClient() {
    if (tokenClient) {
      return;
    }

    if (typeof google === "undefined" || !google.accounts || !google.accounts.oauth2) {
      throw new Error("Google Identity Services non chargé (https://accounts.google.com/gsi/client).");
    }

    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: config.clientId,
      scope: Array.isArray(config.scopes) ? config.scopes.join(" ") : config.scopes,
      callback: () => {}
    });
  }

  function loadPickerScripts() {
    if (pickerInitialized) {
      return Promise.resolve();
    }

    if (pickerLoadingPromise) {
      return pickerLoadingPromise;
    }

    pickerLoadingPromise = new Promise((resolve, reject) => {
      if (typeof gapi === "undefined") {
        reject(new Error("Bibliothèque Google API (apis.google.com/js/api.js) non chargée."));
        return;
      }

      gapi.load("client:picker", async () => {
        try {
          if (!ensureConfigValue(config.apiKey, "YOUR_")) {
            throw new Error("Clé API Google non configurée dans google-config.js.");
          }

          await gapi.client.load("drive", "v3");
          gapi.client.setApiKey(config.apiKey);
          pickerInitialized = true;
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });

    return pickerLoadingPromise;
  }

  function requestAccessToken() {
    ensureTokenClient();

    return new Promise((resolve, reject) => {
      tokenClient.callback = (response) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }
        accessToken = response.access_token;
        resolve(accessToken);
      };

      const prompt = accessToken ? "" : "consent";
      tokenClient.requestAccessToken({ prompt });
    });
  }

  async function getAccessToken() {
    if (accessToken) {
      return accessToken;
    }
    return requestAccessToken();
  }

  function buildPicker(onFolderPicked) {
    if (typeof google === "undefined" || !google.picker) {
      throw new Error("Google Picker non disponible.");
    }

    const docsView = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
      .setIncludeFolders(true)
      .setSelectFolderEnabled(true);

    const pickerBuilder = new google.picker.PickerBuilder()
      .setDeveloperKey(config.apiKey)
      .setLocale(config.pickerLocale || "fr")
      .addView(docsView)
      .setOAuthToken(accessToken)
      .setCallback(onFolderPicked);

    if (config.appId) {
      pickerBuilder.setAppId(config.appId);
    }

    const picker = pickerBuilder.build();
    picker.setVisible(true);
    return picker;
  }

  async function selectFolder() {
    if (!ensureConfigValue(config.clientId, "YOUR_")) {
      throw new Error("Client ID Google non configuré dans google-config.js.");
    }

    await loadPickerScripts();
    await getAccessToken();

    return new Promise((resolve) => {
      buildPicker((data) => {
        if (data.action !== google.picker.Action.PICKED) {
          if (data.action === google.picker.Action.CANCEL) {
            resolve(null);
          }
          return;
        }

        const doc = data.docs && data.docs[0];
        if (!doc) {
          resolve(null);
          return;
        }

        resolve({
          id: doc.id,
          name: doc.name || doc.id,
          url: doc.url || `https://drive.google.com/drive/folders/${doc.id}`
        });
      });
    });
  }

  window.GoogleDrivePicker = {
    async selectFolder() {
      return selectFolder();
    },
    resetSession() {
      accessToken = null;
    }
  };
})();
