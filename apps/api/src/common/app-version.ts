import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

function readVersion(): string {
  // The compiled file lives at different depths depending on environment:
  //   local build:  apps/api/dist/common/app-version.js  → 4× up to root
  //   docker image: /app/dist/common/app-version.js      → 2× up to /app (root pkg.json)
  // Walk upward until we find a package.json with "name": "klar".
  let dir = __dirname;
  for (let i = 0; i < 8; i++) {
    try {
      const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
      if (pkg.name === 'klar' && typeof pkg.version === 'string') {
        return pkg.version;
      }
    } catch {
      // No package.json here, keep walking up.
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.env['APP_VERSION'] ?? 'dev';
}

export const APP_VERSION: string = readVersion();
