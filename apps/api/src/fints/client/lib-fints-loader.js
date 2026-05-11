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

const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

// lib-fints blocks subpath access to its `package.json` via the `exports`
// field, so `createRequire(...).resolve('lib-fints/package.json')` throws
// ERR_PACKAGE_PATH_NOT_EXPORTED. Walk up from this file's directory and
// from NODE_PATH entries to find the package directory on disk, then
// read its package.json manually and import the entry as a file:// URL.

function findPackageDir(name) {
  const candidates = [];
  let dir = __dirname;
  while (true) {
    candidates.push(path.join(dir, 'node_modules', name));
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  for (const entry of (process.env.NODE_PATH ?? '')
    .split(path.delimiter)
    .filter(Boolean)) {
    candidates.push(path.join(entry, name));
  }
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, 'package.json'))) {
      return fs.realpathSync(candidate);
    }
  }
  throw new Error(`Cannot locate package '${name}' on disk`);
}

// Walk nested condition objects (e.g. `{ import: { default: './x.js' } }`)
// preferring conditions valid for our dynamic import().
function resolveConditional(node) {
  if (typeof node === 'string') return node;
  if (!node || typeof node !== 'object') return undefined;
  for (const key of ['import', 'module', 'default', 'node']) {
    if (key in node) {
      const resolved = resolveConditional(node[key]);
      if (resolved) return resolved;
    }
  }
  return undefined;
}

module.exports.loadLibFints = () => {
  const pkgDir = findPackageDir('lib-fints');
  const pkg = JSON.parse(
    fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'),
  );
  const entry =
    resolveConditional(pkg.exports?.['.']) ??
    resolveConditional(pkg.exports) ??
    pkg.module ??
    pkg.main ??
    'index.js';
  return import(pathToFileURL(path.join(pkgDir, entry)).href);
};
