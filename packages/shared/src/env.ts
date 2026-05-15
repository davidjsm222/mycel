import { config } from "dotenv";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Loads `.env` from the current working directory or the first ancestor directory
 * that contains it (so commands work when run from repo root or a package folder).
 */
export function loadMycelEnv(): void {
  let dir = process.cwd();
  for (let i = 0; i < 16; i++) {
    const envPath = join(dir, ".env");
    if (existsSync(envPath)) {
      config({ path: envPath });
      return;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
}
