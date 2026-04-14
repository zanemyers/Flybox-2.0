import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
interface PreservedEnv {
  SERP_API_KEY: string;
  GEMINI_API_KEY: string;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "../.env");

const keysToPreserve: (keyof PreservedEnv)[] = ["SERP_API_KEY", "GEMINI_API_KEY"];

/**
 * Parse existing .env file for only the keys we care about.
 */
function parseEnvFile(content: string): PreservedEnv {
  const env: PreservedEnv = { SERP_API_KEY: "", GEMINI_API_KEY: "" };

  content.split(/\r?\n/).forEach((line) => {
    const [key, ...rest] = line.trim().split("=") as [keyof PreservedEnv, ...string[]];
    if (key && keysToPreserve.includes(key)) {
      env[key] = rest.join("=").replace(/^'|'$/g, "");
    }
  });

  return env;
}

// Load preserved values if the file exists
const preserved: PreservedEnv = fs.existsSync(envPath) ? parseEnvFile(fs.readFileSync(envPath, "utf8")) : { SERP_API_KEY: "", GEMINI_API_KEY: "" };

// Build new .env content
const envContent = `# Local Environment Config
NODE_ENV=development
PORT=3000

# Database Config
DATABASE_URL='postgresql://myuser:mypassword@localhost:5432/mydb?schema=public'

# Scraper configuration
RUN_HEADLESS=true
CONCURRENCY=5

# API keys for development
# - Place actual keys here. Use 'test' during development to avoid re-entering.
SERP_API_KEY='${preserved.SERP_API_KEY}'
GEMINI_API_KEY='${preserved.GEMINI_API_KEY}'`;

// Write to .env
fs.writeFileSync(envPath, envContent, "utf8");
console.log(`✅ .env file created/updated at ${envPath}`);
