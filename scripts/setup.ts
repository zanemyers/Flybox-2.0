import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";

// Appends what Flybox needs and is missing, nothing else. Rebuilding from a template dropped every key not on a preserve list.

const envPath = fileURLToPath(new URL("../.env", import.meta.url));
const LOCAL_DB = "postgresql://flybox:flybox@localhost:5432/flybox";

const REQUIRED: [key: string, fallback: string, note?: string][] = [
  // Local defaults carry no sslmode (the container serves no TLS); pg reads 'require' as verify-full today, unverified in v9.
  ["DATABASE_URL", LOCAL_DB, "Runtime connection. May point at a pooler. Hosted: end it with ?sslmode=verify-full."],
  ["DIRECT_URL", LOCAL_DB, "Prisma migrations. Must be a direct connection. Hosted: sslmode=verify-full here too."],
  ["RUN_HEADLESS", "true", "Set false to watch the Playwright browser work."],
  ["SERP_API_KEY", "", "Every run needs this. Flybox supplies its own keys and never asks the user for one."],
  ["OPENAI_API_KEY", "", "Needed only when summarizing."],
  ["RATE_LIMIT_SALT", "", "Fine to leave empty locally: a per-process salt resets your client limits on restart, so testing is not capped."],
];

const current = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
const defined = parse(current);
const missing = REQUIRED.filter(([key]) => !Object.hasOwn(defined, key));

if (!missing.length) {
  console.log(`.env already has every setting Flybox needs: ${envPath}`);
} else {
  const header = current ? "" : "# Local environment for Flybox. Nothing here is ever sent to the browser.";
  const added = missing.map(([key, fallback, note]) => `${note ? `# ${note}\n` : ""}${key}='${fallback}'`).join("\n\n");
  fs.writeFileSync(envPath, `${[current.trimEnd(), header, added].filter(Boolean).join("\n\n")}\n`, "utf8");
  console.log(`Added to .env: ${missing.map(([key]) => key).join(", ")}`);
}
