import { Buffer } from "buffer";
import {
  ExternalConnector,
  ConnectorAuthConfig,
  ExternalItem,
  ConnectorType,
  ExternalItemContent,
} from "../interfaces.js";

export interface KaggleConnectorOptions {
  username: string;
  apiKey: string;
  /** "owner/slug" — same format as GitHub's external_repo_id */
  ref: string;
  subtype: "kaggle_dataset" | "kaggle_model";
}

/**
 * Kaggle connector — handles both datasets and models.
 *
 * - kaggle_dataset: fetches the dataset's README.md as a single file
 * - kaggle_model:   fetches the model card metadata as model_card.json
 *
 * fetchItemContent() returns the same shape as the GitHub connector
 * ({ commitSha, modifiedFiles[] }) so the snapshot service works unchanged.
 */
export class KaggleConnector implements ExternalConnector {
  readonly name = "Kaggle Connector";
  readonly type: ConnectorType;
  readonly authConfig: ConnectorAuthConfig;

  private readonly username: string;
  private readonly apiKey: string;
  private readonly owner: string;
  private readonly slug: string;
  private readonly subtype: "kaggle_dataset" | "kaggle_model";

  private readonly baseUrl = "https://www.kaggle.com/api/v1";

  constructor(options: KaggleConnectorOptions) {
    this.username = options.username;
    this.apiKey = options.apiKey;
    this.subtype = options.subtype;
    this.type = options.subtype;
    this.authConfig = { apiKey: options.apiKey };

    const [owner, slug] = options.ref.split("/");
    this.owner = owner;
    this.slug = slug;
  }

  // ─── Auth ────────────────────────────────────────────────────────────────

  private get authHeader(): string {
    return (
      "Basic " +
      Buffer.from(`${this.username}:${this.apiKey}`).toString("base64")
    );
  }

  // ─── HTTP helpers ─────────────────────────────────────────────────────────

  private async kaggleFetch(endpoint: string): Promise<any> {
    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        Authorization: this.authHeader,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(
        `Kaggle API error ${res.status}: ${res.statusText} (${endpoint})`
      );
    }

    return res.json();
  }

  private async kaggleFetchText(endpoint: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: { Authorization: this.authHeader },
      redirect: "follow",
    });

    if (!res.ok) {
      throw new Error(
        `Kaggle API error ${res.status}: ${res.statusText} (${endpoint})`
      );
    }

    return res.text();
  }

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  async connect(): Promise<void> {
    if (!this.username || !this.apiKey) {
      throw new Error(
        "[KaggleConnector] Missing KAGGLE_USERNAME or KAGGLE_KEY"
      );
    }

    if (!this.owner || !this.slug) {
      throw new Error(
        `[KaggleConnector] Invalid ref format. Expected "owner/slug", got "${this.owner}/${this.slug}"`
      );
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      if (this.subtype === "kaggle_dataset") {
        await this.kaggleFetch(`/datasets/${this.owner}/${this.slug}`);
      } else {
        await this.kaggleFetch(`/models/${this.owner}/${this.slug}/get`);
      }
      return true;
    } catch {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    // Nothing to clean up
  }

  // ─── fetchItems ───────────────────────────────────────────────────────────

  async fetchItems(): Promise<ExternalItem[]> {
    if (this.subtype === "kaggle_dataset") {
      return this.fetchDatasetItem();
    }
    return this.fetchModelItem();
  }

  private async fetchDatasetItem(): Promise<ExternalItem[]> {
    const metadata = await this.kaggleFetch(
      `/datasets/${this.owner}/${this.slug}`
    );

    // Find README among dataset files (case-insensitive)
    const filesData = await this.kaggleFetch(
      `/datasets/${this.owner}/${this.slug}/files`
    );
    const files: any[] = filesData.datasetFiles ?? filesData.files ?? [];
    const readmeFile = files.find((f: any) =>
      ["readme.md", "readme.txt"].includes(f.name?.toLowerCase())
    );

    return [
      {
        id: `${this.owner}/${this.slug}`,
        name: metadata.title || this.slug,
        type: "kaggle_dataset",
        url: `https://www.kaggle.com/datasets/${this.owner}/${this.slug}`,
        metadata: {
          owner: this.owner,
          slug: this.slug,
          description: metadata.description,
          totalBytes: metadata.totalBytes,
          lastUpdated: metadata.lastUpdated,
          downloadCount: metadata.downloadCount,
          voteCount: metadata.voteCount,
          tags: metadata.tags,
          readmeFileName: readmeFile?.name ?? "README.md",
        },
      },
    ];
  }

  private async fetchModelItem(): Promise<ExternalItem[]> {
    const metadata = await this.kaggleFetch(
      `/models/${this.owner}/${this.slug}/get`
    );

    return [
      {
        id: `${this.owner}/${this.slug}`,
        name: metadata.title || this.slug,
        type: "kaggle_model",
        url: `https://www.kaggle.com/models/${this.owner}/${this.slug}`,
        metadata: {
          owner: this.owner,
          slug: this.slug,
          description: metadata.description,
          framework: metadata.framework,
          overview: metadata.overview,
          tags: metadata.tags,
          publishTime: metadata.publishTime,
          lastUpdated: metadata.lastUpdated,
        },
      },
    ];
  }

  // ─── fetchItemContent ─────────────────────────────────────────────────────

  /**
   * Returns the same shape as the GitHub connector so the snapshot service
   * can process Kaggle resources without any changes.
   */
  async fetchItemContent(itemId: string): Promise<ExternalItemContent> {
    if (this.subtype === "kaggle_dataset") {
      return this.fetchDatasetContent(itemId);
    }
    return this.fetchModelContent(itemId);
  }

  private async fetchDatasetContent(itemId: string) {
    let content: string;

    // Try README.md first, then readme.md, then fall back to description
    try {
      content = await this.kaggleFetchText(
        `/datasets/${this.owner}/${this.slug}/download/README.md`
      );
    } catch {
      try {
        content = await this.kaggleFetchText(
          `/datasets/${this.owner}/${this.slug}/download/readme.md`
        );
      } catch {
        const metadata = await this.kaggleFetch(
          `/datasets/${this.owner}/${this.slug}`
        );
        content =
          metadata.description ||
          `# ${metadata.title || this.slug}\n\nNo README available.`;
      }
    }

    const lineCount = content.split("\n").length;

    return {
      commitSha: itemId,
      modifiedFiles: [
        {
          path: "README.md",
          status: "added",
          additions: lineCount,
          deletions: 0,
          changes: lineCount,
          sha: "",
          isBinary: false,
          contentEncoding: "utf-8",
          content,
        },
      ],
    };
  }

  private async fetchModelContent(itemId: string) {
    const metadata = await this.kaggleFetch(
      `/models/${this.owner}/${this.slug}/get`
    );
    const content = JSON.stringify(metadata, null, 2);
    const lineCount = content.split("\n").length;

    return {
      commitSha: itemId,
      modifiedFiles: [
        {
          path: "model_card.json",
          status: "added",
          additions: lineCount,
          deletions: 0,
          changes: lineCount,
          sha: "",
          isBinary: false,
          contentEncoding: "utf-8",
          content,
        },
      ],
    };
  }
}
