import { google, drive_v3 } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { Buffer } from "buffer";
import {
  ExternalConnector,
  ConnectorAuthConfig,
  ExternalItem,
  ConnectorType,
} from "../interfaces.js";

/**
 * GoogleDrive2Connector - Implémente l'interface ExternalConnector
 * pour interagir avec Google Drive via l'API v3
 */
export class GoogleDriveConnector implements ExternalConnector {
  name = "Google Drive";
  type: ConnectorType = "google_drive";
  authConfig: ConnectorAuthConfig;

  private oauth2Client?: OAuth2Client;
  private drive?: drive_v3.Drive;
  private connected = false;

  constructor(authConfig: ConnectorAuthConfig) {
    this.authConfig = authConfig;
  }

  /**
   * Initialise la connexion OAuth2 avec Google Drive
   */
  async connect(): Promise<void> {
    const { clientId, clientSecret, refreshToken } = this.authConfig;

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error(
        "GoogleDrive2Connector requires clientId, clientSecret, and refreshToken in authConfig"
      );
    }

    this.oauth2Client = new google.auth.OAuth2({
      clientId,
      clientSecret,
      redirectUri: this.authConfig.redirectUri || "urn:ietf:wg:oauth:2.0:oob",
    });

    this.oauth2Client.setCredentials({
      refresh_token: refreshToken,
    });

    this.drive = google.drive({ version: "v3", auth: this.oauth2Client });
    this.connected = true;
  }

  /**
   * Teste la connexion en tentant de lister les fichiers
   */
  async testConnection(): Promise<boolean> {
    if (!this.connected || !this.drive) {
      return false;
    }

    try {
      await this.drive.files.list({
        pageSize: 1,
        fields: "files(id,name)",
      });
      return true;
    } catch (error) {
      console.error("[GoogleDrive2Connector] Connection test failed:", error);
      return false;
    }
  }

  /**
   * Récupère une liste de fichiers/dossiers depuis Google Drive
   * 
   * Options supportées:
   * - folderId: ID du dossier parent (optionnel)
   * - query: requête de recherche Google Drive (optionnel)
   * - pageSize: nombre d'éléments par page (défaut: 100)
   * - orderBy: critère de tri (défaut: "modifiedTime desc")
   * - mimeType: filtrer par type MIME (optionnel)
   */
  async fetchItems(options?: Record<string, any>): Promise<ExternalItem[]> {
    if (!this.connected || !this.drive) {
      throw new Error("Not connected. Call connect() first.");
    }

    const pageSize = options?.pageSize || 100;
    const orderBy = options?.orderBy || "modifiedTime desc";
    
    // Construire la requête de recherche
    let query = "trashed = false";
    
    if (options?.folderId) {
      query += ` and '${options.folderId}' in parents`;
    }
    
    if (options?.query) {
      query += ` and ${options.query}`;
    }
    
    if (options?.mimeType) {
      query += ` and mimeType='${options.mimeType}'`;
    }

    try {
      const response = await this.drive.files.list({
        q: query,
        pageSize,
        orderBy,
        fields:
          "files(id,name,mimeType,modifiedTime,size,webViewLink,iconLink,parents)",
      });

      const files = response.data.files || [];

      return files.map((file) => ({
        id: file.id!,
        name: file.name!,
        type: this.determineItemType(file.mimeType || ""),
        url: file.webViewLink ?? undefined,
        metadata: {
          mimeType: file.mimeType,
          modifiedTime: file.modifiedTime,
          size: file.size,
          iconLink: file.iconLink,
          parents: file.parents,
        },
      }));
    } catch (error) {
      console.error("[GoogleDrive2Connector] fetchItems failed:", error);
      throw new Error(`Failed to fetch items: ${error}`);
    }
  }

  /**
   * Récupère le contenu détaillé d'un fichier
   * Retourne le contenu en Buffer pour les fichiers binaires
   * ou en string pour les fichiers texte
   */
  async fetchItemContent(itemId: string): Promise<any> {
    if (!this.connected || !this.drive) {
      throw new Error("Not connected. Call connect() first.");
    }

    try {
      // 1. Récupérer les métadonnées du fichier
      const metadata = await this.drive.files.get({
        fileId: itemId,
        fields: "id,name,mimeType,size,modifiedTime,webViewLink",
      });

      const mimeType = metadata.data.mimeType || "";

      // 2. Si c'est un dossier, retourner les métadonnées uniquement
      if (mimeType === "application/vnd.google-apps.folder") {
        return {
          metadata: metadata.data,
          type: "folder",
          content: null,
        };
      }

      // 3. Si c'est un Google Doc natif, l'exporter en text/plain
      if (this.isGoogleNativeDoc(mimeType)) {
        console.log(`[GoogleDriveConnector] Exporting Google Doc as text/plain`);
        
        const response = await this.drive.files.export(
          { fileId: itemId, mimeType: "text/plain" },
          { responseType: "arraybuffer" }
        );

        let content: Buffer | string;

        if (response.data instanceof ArrayBuffer) {
          content = Buffer.from(response.data);
        } else if (typeof response.data === "string") {
          content = Buffer.from(response.data, "utf-8");
        } else {
          content = Buffer.from(JSON.stringify(response.data));
        }

        return {
          metadata: metadata.data,
          type: "google_doc",
          content: content.toString("utf-8"),
          mimeType,
          exportedAs: "text/plain",
        };
      }

      // 4. Télécharger le contenu du fichier standard
      const response = await this.drive.files.get(
        { fileId: itemId, alt: "media" },
        { responseType: "arraybuffer" }
      );

      let content: Buffer | string;

      if (response.data instanceof ArrayBuffer) {
        content = Buffer.from(response.data);
      } else if (typeof response.data === "string") {
        content = Buffer.from(response.data, "utf-8");
      } else {
        content = Buffer.from(JSON.stringify(response.data));
      }

      // 5. Si c'est un fichier texte, convertir en string
      if (this.isTextMimeType(mimeType)) {
        return {
          metadata: metadata.data,
          type: "file",
          content: content.toString("utf-8"),
          mimeType,
        };
      }

      // 6. Sinon retourner le Buffer brut
      return {
        metadata: metadata.data,
        type: "file",
        content,
        mimeType,
      };
    } catch (error) {
      console.error(
        `[GoogleDrive2Connector] fetchItemContent failed for ${itemId}:`,
        error
      );
      throw new Error(`Failed to fetch item content: ${error}`);
    }
  }

  /**
   * Nettoyage des ressources (optionnel)
   */
  async disconnect(): Promise<void> {
    this.oauth2Client = undefined;
    this.drive = undefined;
    this.connected = false;
  }

  /* ---- Helpers privés ---- */

  /**
   * Détermine le type d'élément basé sur le MIME type
   */
  private determineItemType(mimeType: string): string {
    if (mimeType === "application/vnd.google-apps.folder") {
      return "folder";
    }
    if (mimeType.startsWith("application/vnd.google-apps.")) {
      return "google_doc";
    }
    if (mimeType.startsWith("image/")) {
      return "image";
    }
    if (mimeType.startsWith("video/")) {
      return "video";
    }
    if (mimeType.startsWith("audio/")) {
      return "audio";
    }
    if (
      mimeType.startsWith("text/") ||
      mimeType.includes("json") ||
      mimeType.includes("xml")
    ) {
      return "text";
    }
    return "file";
  }

  /**
   * Vérifie si un MIME type correspond à un fichier texte
   */
  private isTextMimeType(mimeType: string): boolean {
    const textTypes = [
      "text/",
      "application/json",
      "application/xml",
      "application/javascript",
      "application/typescript",
    ];
    return textTypes.some((type) => mimeType.startsWith(type));
  }

  /**
   * Vérifie si le MIME type correspond à un Google Doc natif
   */
  private isGoogleNativeDoc(mimeType: string): boolean {
    const googleDocTypes = [
      "application/vnd.google-apps.document",      // Google Docs
      "application/vnd.google-apps.spreadsheet",   // Google Sheets
      "application/vnd.google-apps.presentation",  // Google Slides
      "application/vnd.google-apps.drawing",       // Google Drawings
      "application/vnd.google-apps.form",          // Google Forms
      "application/vnd.google-apps.script",        // Google Apps Script
    ];
    return googleDocTypes.includes(mimeType);
  }
}