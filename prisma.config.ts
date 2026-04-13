import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "db/schema.prisma",
  migrations: {
    path: "db/migrations",
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
});
