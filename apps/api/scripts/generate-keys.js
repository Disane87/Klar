"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const keysDir = (0, node_path_1.join)(process.cwd(), 'keys');
const privateKeyPath = (0, node_path_1.join)(keysDir, 'private.pem');
const publicKeyPath = (0, node_path_1.join)(keysDir, 'public.pem');
if ((0, node_fs_1.existsSync)(privateKeyPath) && (0, node_fs_1.existsSync)(publicKeyPath)) {
    console.log('Keys already exist — skipping. Delete keys/ to regenerate.');
    process.exit(0);
}
if (!(0, node_fs_1.existsSync)(keysDir)) {
    (0, node_fs_1.mkdirSync)(keysDir, { recursive: true });
}
const { privateKey, publicKey } = (0, node_crypto_1.generateKeyPairSync)('rsa', {
    modulusLength: 4096,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
(0, node_fs_1.writeFileSync)(privateKeyPath, privateKey, { mode: 0o600 });
(0, node_fs_1.writeFileSync)(publicKeyPath, publicKey);
console.log('✓ JWT RS256 key pair generated:');
console.log('  keys/private.pem  (mode 0600 — keep secret)');
console.log('  keys/public.pem');
console.log('');
console.log('Add to .env:');
console.log('  JWT_PRIVATE_KEY_PATH=keys/private.pem');
console.log('  JWT_PUBLIC_KEY_PATH=keys/public.pem');
//# sourceMappingURL=generate-keys.js.map