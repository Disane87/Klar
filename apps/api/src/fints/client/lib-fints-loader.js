// Loads ESM-only lib-fints from our CommonJS NestJS API.
//
// lib-fints ships `"type": "module"` with import-only `exports`, so the
// CommonJS `require('lib-fints')` that TypeScript otherwise emits can't
// resolve it. Native Node `import()` from inside a `.js` CJS module
// works, and because this file is plain JS (not .ts), the TypeScript
// compiler doesn't transform the dynamic import into a require().
//
// Resolution detail: in the production image pnpm only installs
// `lib-fints` under `apps/api/node_modules`, and the Dockerfile relies on
// `NODE_PATH` to make CJS `require` find it. `NODE_PATH` does NOT apply
// to native ESM bare-specifier resolution, so `import('lib-fints')` would
// fail at runtime from `/app/dist/...`. We use `createRequire` (which
// honors `NODE_PATH`) to resolve the package on disk, then `import()`
// the resolved entry as a `file://` URL.
//
// The fints-client.service.ts above requires this loader once and caches
// the resolved module — so we pay the resolution cost exactly once per
// process.

const { createRequire } = require('node:module');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

const localRequire = createRequire(__filename);

module.exports.loadLibFints = () => {
  const pkgJsonPath = localRequire.resolve('lib-fints/package.json');
  const pkg = localRequire(pkgJsonPath);
  const exportsField = pkg.exports?.['.'];
  const entry =
    (typeof exportsField === 'string' ? exportsField : exportsField?.import) ??
    pkg.module ??
    pkg.main ??
    'index.js';
  const resolvedPath = path.join(path.dirname(pkgJsonPath), entry);
  return import(pathToFileURL(resolvedPath).href);
};
