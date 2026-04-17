import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
interface PreservedEnv {
  DATABASE_URL: string;
  DIRECT_URL: string;
  SERP_API_KEY: string;
  GEMINI_API_KEY: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "../.env");

const keysToPreserve: (keyof PreservedEnv)[] = ["DATABASE_URL", "DIRECT_URL", "SERP_API_KEY", "GEMINI_API_KEY"];

function parseEnvFile(content: string): PreservedEnv {
  const env: PreservedEnv = { DATABASE_URL: "", DIRECT_URL: "", SERP_API_KEY: "", GEMINI_API_KEY: "" };

  content.split(/\r?\n/).forEach((line) => {
    const [key, ...rest] = line.trim().split("=") as [keyof PreservedEnv, ...string[]];
    if (key && keysToPreserve.includes(key)) {
      env[key] = rest.join("=").replace(/^'|'$/g, "");
    }
  });

  return env;
}

const DEFAULT_DB_URL = "postgresql://flybox:flybox@localhost:5432/flybox";

// Load preserved values if the file exists
const preserved: PreservedEnv = fs.existsSync(envPath) ? parseEnvFile(fs.readFileSync(envPath, "utf8")) : { DATABASE_URL: "", DIRECT_URL: "", SERP_API_KEY: "", GEMINI_API_KEY: "" };

// Build new .env content
const envContent = `# Local Environment Config
NODE_ENV=development

# Database — DATABASE_URL can use a pooler; DIRECT_URL must be a direct connection (used by Prisma migrations)
DATABASE_URL='${preserved.DATABASE_URL || DEFAULT_DB_URL}'
DIRECT_URL='${preserved.DIRECT_URL || DEFAULT_DB_URL}'

# Scraper configuration
RUN_HEADLESS=true

# API keys for development
SERP_API_KEY='${preserved.SERP_API_KEY}'
GEMINI_API_KEY='${preserved.GEMINI_API_KEY}'`;

// Write to .env
fs.writeFileSync(envPath, envContent, "utf8");
console.log(`✅ .env file created/updated at ${envPath}`);
