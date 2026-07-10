import { Buffer } from "buffer";
import {
  ExternalConnector,
  ConnectorAuthConfig,
  ExternalItem,
  ConnectorType,
  KaggleModelMetrics,
} from "../interfaces.js";

/**
 * Best-effort metric extraction from a Kaggle model version's overview/description field.
 * Tries JSON.parse first, then falls back to regex.
 * Never throws — returns {} on any failure.
 */
export function parseMetrics(overview: string): KaggleModelMetrics {
  if (!overview) return {};

  // Attempt 1: the whole field is JSON
  try {
    const parsed = JSON.parse(overview);
    if (typeof parsed === 'object' && parsed !== null) {
      const result: KaggleModelMetrics = {};
      for (const key of ['auc', 'f1', 'accuracy'] as const) {
        const val = parsed[key];
        if (typeof val === 'number' && isFinite(val)) result[key] = val;
      }
      if (Object.keys(result).length > 0) return result;
    }
  } catch {
    // not JSON
  }

  // Attempt 2: embedded JSON block { ... } inside markdown
  const jsonMatch = overview.match(/\{[^{}]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (typeof parsed === 'object' && parsed !== null) {
        const result: KaggleModelMetrics = {};
        for (const key of ['auc', 'f1', 'accuracy'] as const) {
          const val = parsed[key];
          if (typeof val === 'number' && isFinite(val)) result[key] = val;
        }
        if (Object.keys(result).length > 0) return result;
      }
    } catch {
      // not a valid JSON block
    }
  }

  // Attempt 3: key: value regex patterns (e.g. "auc: 0.92" or `"auc": 0.92`)
  const result: KaggleModelMetrics = {};
  for (const key of ['auc', 'f1', 'accuracy'] as const) {
    const match = overview.match(new RegExp(`["']?${key}["']?\\s*:\\s*([0-9]*\\.?[0-9]+)`, 'i'));
    if (match) {
      const val = parseFloat(match[1]);
      if (isFinite(val)) result[key] = val;
    }
  }
  return result;
}

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

  // ─── fetchRepoActivity ────────────────────────────────────────────────────

  async fetchRepoActivity(): Promise<import('../interfaces.js').KaggleRepoActivity> {
    if (this.subtype === 'kaggle_dataset') {
      return this.fetchDatasetActivity();
    }
    return this.fetchModelActivity();
  }

  private async fetchDatasetActivity(): Promise<import('../interfaces.js').KaggleRepoActivity> {
    const metadata = await this.kaggleFetch(`/datasets/${this.owner}/${this.slug}`);

    return {
      type: 'kaggle_dataset',
      datasetMeta: {
        title: metadata.title || this.slug,
        description: metadata.description,
        tags: Array.isArray(metadata.tags) ? metadata.tags.map((t: any) => t.name ?? t) : [],
        url: `https://www.kaggle.com/datasets/${this.owner}/${this.slug}`,
        lastUpdated: metadata.lastUpdated,
      },
    };
  }

  private async fetchModelActivity(): Promise<import('../interfaces.js').KaggleRepoActivity> {
    // 1. List model instances (one per framework)
    let instances: any[] = [];
    try {
      const resp = await this.kaggleFetch(`/models/${this.owner}/${this.slug}/instances`);
      instances = Array.isArray(resp) ? resp : (resp.instances ?? []);
    } catch {
      return { type: 'kaggle_model', modelVersions: [] };
    }

    // 2. For each instance, fetch versions and parse metrics
    const versionsPerInstance = await Promise.all(
      instances.map(async (inst: any) => {
        const framework = inst.framework ?? inst.modelFramework ?? 'unknown';
        const instanceSlug = inst.overview ?? inst.instanceSlug ?? inst.slug ?? 'default';
        try {
          const resp = await this.kaggleFetch(
            `/models/${this.owner}/${this.slug}/${framework}/${instanceSlug}/versions`
          );
          const raw: any[] = Array.isArray(resp) ? resp : (resp.versions ?? []);
          return raw.map((v: any): import('../interfaces.js').KaggleModelVersion => ({
            versionNumber: v.versionNumber ?? v.version ?? 0,
            createdAt: v.createdAt ?? v.publishTime ?? new Date(0).toISOString(),
            metrics: parseMetrics(v.overview ?? v.description ?? ''),
          }));
        } catch {
          return [];
        }
      })
    );

    // 3. Flatten all versions under one ref, sorted by version number
    const allVersions = versionsPerInstance.flat().sort(
      (a, b) => a.versionNumber - b.versionNumber
    );

    return {
      type: 'kaggle_model',
      modelVersions: [
        { ref: `${this.owner}/${this.slug}`, versions: allVersions },
      ],
    };
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
  async fetchItemContent(itemId: string): Promise<{
    commitSha: string;
    modifiedFiles: Array<{
      path: string;
      status: string;
      additions: number;
      deletions: number;
      changes: number;
      sha: string;
      isBinary: boolean;
      contentEncoding: string;
      content: string;
    }>;
  }> {
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
