import fs from "fs";
import path from "path";
import dotenv from "dotenv";

/**
 * Loads environment variables from:
 * 1) project-root/.env (one level above backend/)
 * 2) backend/.env (current working dir when running backend)
 * Values already set in process.env are not overridden.
 */
export function loadEnv(): void {
  const cwd = process.cwd();
  const rootEnv = path.resolve(cwd, "..", ".env");
  const backendEnv = path.resolve(cwd, ".env");

  // 1) Load project root first (does NOT override existing process.env)
  if (fs.existsSync(rootEnv)) {
    dotenv.config({ path: rootEnv, override: false });
  }
  // 2) Load backend/.env second and ALLOW override, so local backend config wins
  if (fs.existsSync(backendEnv)) {
    dotenv.config({ path: backendEnv, override: true });
  }
}
