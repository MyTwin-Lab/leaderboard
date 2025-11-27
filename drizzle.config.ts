import type { Config } from "drizzle-kit";
import { config } from "./packages/config/index.js";

export default {
  schema: "./packages/database-service/db/drizzle.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: config.database.url,
  },
} satisfies Config;