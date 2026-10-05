import fs from 'node:fs';
import path from 'node:path';

/**
 * Loads `.env.local` for the standalone scripts.
 *
 * Next.js reads `.env.local` itself, but `tsx scripts/seed.ts` runs outside the
 * framework, so the file has to be parsed here. Node's own `--env-file` would
 * also work, but this keeps the npm script short and works identically on
 * Windows. Real environment variables always win.
 */

const FILES = ['.env.local', '.env'];

let loaded = false;

export function loadEnv(): void {
  if (loaded) return;
  loaded = true;

  for (const name of FILES) {
    const file = path.join(process.cwd(), name);
    if (!fs.existsSync(file)) continue;

    const text = fs.readFileSync(file, 'utf8');
    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      const eq = line.indexOf('=');
      if (eq === -1) continue;

      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();

      // Strip matching quotes.
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

loadEnv();
