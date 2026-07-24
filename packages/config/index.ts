import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    API_PORT: z.coerce.number().int().positive().default(3001),
    FRONTEND_URL: z
      .string()
      .url()
      .default("http://localhost:3000"),
    DATABASE_URL: z
      .string()
      .min(1, "DATABASE_URL is required"),
    // JWT Auth (nouveau système)
    JWT_SECRET: z
      .string()
      .min(32, "JWT_SECRET must be at least 32 characters"),
    JWT_ACCESS_EXPIRY: z.string().default("15m"),
    JWT_REFRESH_EXPIRY: z.string().default("7d"),
    // Basic Auth (deprecated, optionnel pour transition)
    ADMIN_USERNAME: z.string().optional(),
    ADMIN_PASSWORD: z.string().optional(),
    GITHUB_TOKEN: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GOOGLE_REFRESH_TOKEN: z.string().optional(),
    GOOGLE_REDIRECT_URI: z.string().optional(),
    GOOGLE_FOLDER_ID: z.string().optional(),
    // Google Workspace (Sync Meetings)
    GOOGLE_WORKSPACE_SERVICE_ACCOUNT_EMAIL: z.string().optional(),
    GOOGLE_WORKSPACE_SERVICE_ACCOUNT_KEY: z.string().optional(),
    GOOGLE_WORKSPACE_ADMIN_EMAIL: z.string().optional(),
    GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
    GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
    GOOGLE_OAUTH_REDIRECT_URI: z.string().optional(),
    // Kaggle
    KAGGLE_USERNAME: z.string().optional(),
    KAGGLE_KEY: z.string().optional(),
    // Slack (fallback dev — la connexion normale passe par app_settings)
    SLACK_BOT_TOKEN: z.string().optional(),
    // Cron Security
    CRON_SECRET: z.string().optional(),
    // GitHub OAuth App
    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),
    GITHUB_OAUTH_REDIRECT_URI: z.string().optional(),
    GITHUB_TOKEN_ENCRYPTION_KEY: z.string().optional(),
  })
  .strict();

const envInput = {
  NODE_ENV: process.env.NODE_ENV,
  API_PORT: process.env.API_PORT,
  FRONTEND_URL: process.env.FRONTEND_URL,
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY,
  JWT_REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY,
  ADMIN_USERNAME: process.env.ADMIN_USERNAME,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN,
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
  GOOGLE_FOLDER_ID: process.env.GOOGLE_FOLDER_ID,
  GOOGLE_WORKSPACE_SERVICE_ACCOUNT_EMAIL: process.env.GOOGLE_WORKSPACE_SERVICE_ACCOUNT_EMAIL,
  GOOGLE_WORKSPACE_SERVICE_ACCOUNT_KEY: process.env.GOOGLE_WORKSPACE_SERVICE_ACCOUNT_KEY,
  GOOGLE_WORKSPACE_ADMIN_EMAIL: process.env.GOOGLE_WORKSPACE_ADMIN_EMAIL,
  GOOGLE_OAUTH_CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID,
  GOOGLE_OAUTH_CLIENT_SECRET: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  GOOGLE_OAUTH_REDIRECT_URI: process.env.GOOGLE_OAUTH_REDIRECT_URI,
  KAGGLE_USERNAME: process.env.KAGGLE_USERNAME,
  KAGGLE_KEY: process.env.KAGGLE_KEY,
  SLACK_BOT_TOKEN: process.env.SLACK_BOT_TOKEN,
  CRON_SECRET: process.env.CRON_SECRET,
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET,
  GITHUB_OAUTH_REDIRECT_URI: process.env.GITHUB_OAUTH_REDIRECT_URI,
  GITHUB_TOKEN_ENCRYPTION_KEY: process.env.GITHUB_TOKEN_ENCRYPTION_KEY,
};

const parsedEnv = envSchema.safeParse(envInput);

if (!parsedEnv.success) {
  const formattedErrors = parsedEnv.error.issues
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(
    `Invalid environment configuration:\n${formattedErrors}`
  );
}

const env = parsedEnv.data;

export const config = {
  nodeEnv: env.NODE_ENV,
  api: {
    port: env.API_PORT,
    frontendUrl: env.FRONTEND_URL,
  },
  database: {
    url: env.DATABASE_URL,
  },
  auth: {
    jwtSecret: env.JWT_SECRET,
    accessExpiry: env.JWT_ACCESS_EXPIRY,
    refreshExpiry: env.JWT_REFRESH_EXPIRY,
  },
  admin: {
    username: env.ADMIN_USERNAME,
    password: env.ADMIN_PASSWORD,
  },
  github: {
    token: env.GITHUB_TOKEN,
  },
  openai: {
    apiKey: env.OPENAI_API_KEY,
  },
  google: {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    refreshToken: env.GOOGLE_REFRESH_TOKEN,
    redirectUri: env.GOOGLE_REDIRECT_URI,
    folderId: env.GOOGLE_FOLDER_ID,
  },
  googleWorkspace: {
    serviceAccountEmail: env.GOOGLE_WORKSPACE_SERVICE_ACCOUNT_EMAIL,
    serviceAccountKey: env.GOOGLE_WORKSPACE_SERVICE_ACCOUNT_KEY,
    adminEmail: env.GOOGLE_WORKSPACE_ADMIN_EMAIL,
    oauthClientId: env.GOOGLE_OAUTH_CLIENT_ID,
    oauthClientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
    oauthRedirectUri: env.GOOGLE_OAUTH_REDIRECT_URI,
  },
  kaggle: {
    username: env.KAGGLE_USERNAME,
    apiKey: env.KAGGLE_KEY,
  },
  slack: {
    botToken: env.SLACK_BOT_TOKEN,
  },
  cron: {
    secret: env.CRON_SECRET,
  },
  githubOAuth: {
    clientId: env.GITHUB_CLIENT_ID,
    clientSecret: env.GITHUB_CLIENT_SECRET,
    redirectUri: env.GITHUB_OAUTH_REDIRECT_URI,
    encryptionKey: env.GITHUB_TOKEN_ENCRYPTION_KEY,
  },
} as const;

export type AppConfig = typeof config;
