// Loads ESM-only lib-fints from our CommonJS NestJS API.
//
// lib-fints ships `"type": "module"` with import-only `exports`, so the
// CommonJS `require('lib-fints')` that TypeScript otherwise emits can't
// resolve it. Native Node `import()` from inside a `.js` CJS module
// works, and because this file is plain JS (not .ts), the TypeScript
// compiler doesn't transform the dynamic import into a require().
//
// The fints-client.service.ts above requires this loader once and caches
// the resolved module — so we pay the dynamic-import cost exactly once
// per process.

module.exports.loadLibFints = () => import('lib-fints');
