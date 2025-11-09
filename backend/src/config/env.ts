import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

let loaded = false;

export function loadEnv(): void {
	if (loaded) return;

	// Try project-root .env using a stable, file-based path (works regardless of CWD)
	const __filename = fileURLToPath(import.meta.url);
	const __dirname = path.dirname(__filename);
	const projectRoot = path.resolve(__dirname, "../../..");
	const rootEnvPath = path.join(projectRoot, ".env");

	// 1) Load from project root explicitly
	dotenv.config({ path: rootEnvPath });
	// 2) Also allow fallback to current working directory if a local .env exists
	dotenv.config();

	loaded = true;
}


