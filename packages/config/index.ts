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
    ADMIN_USERNAME: z
      .string()
      .min(1, "ADMIN_USERNAME is required"),
    ADMIN_PASSWORD: z
      .string()
      .min(1, "ADMIN_PASSWORD is required"),
    GITHUB_TOKEN: z.string().optional(),
    OPENAI_API_KEY: z.string().optional(),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    GOOGLE_REFRESH_TOKEN: z.string().optional(),
    GOOGLE_REDIRECT_URI: z.string().optional(),
    GOOGLE_FOLDER_ID: z.string().optional(),
  })
  .strict();

const envInput = {
  NODE_ENV: process.env.NODE_ENV,
  API_PORT: process.env.API_PORT,
  FRONTEND_URL: process.env.FRONTEND_URL,
  DATABASE_URL: process.env.DATABASE_URL,
  ADMIN_USERNAME: process.env.ADMIN_USERNAME,
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
  GITHUB_TOKEN: process.env.GITHUB_TOKEN,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  GOOGLE_REFRESH_TOKEN: process.env.GOOGLE_REFRESH_TOKEN,
  GOOGLE_REDIRECT_URI: process.env.GOOGLE_REDIRECT_URI,
  GOOGLE_FOLDER_ID: process.env.GOOGLE_FOLDER_ID,
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
} as const;

export type AppConfig = typeof config;
