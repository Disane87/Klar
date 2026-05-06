/**
 * Erzeugt das RS256-Key-Pair für MCP-OAuth-Tokens, getrennt vom Klar-Session-JWT.
 * Idempotent — überspringt, wenn die Dateien existieren.
 */
import { generateKeyPairSync } from 'node:crypto';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const keysDir = join(process.cwd(), 'keys');
const privateKeyPath = join(keysDir, 'mcp.private.pem');
const publicKeyPath = join(keysDir, 'mcp.public.pem');

if (existsSync(privateKeyPath) && existsSync(publicKeyPath)) {
  console.log('MCP keys already exist — skipping. Delete keys/mcp.* to regenerate.');
  process.exit(0);
}

if (!existsSync(keysDir)) {
  mkdirSync(keysDir, { recursive: true });
}

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 4096,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

writeFileSync(privateKeyPath, privateKey, { mode: 0o600 });
writeFileSync(publicKeyPath, publicKey);

console.log('✓ MCP RS256 key pair generated:');
console.log('  keys/mcp.private.pem  (mode 0600 — keep secret)');
console.log('  keys/mcp.public.pem');
console.log('');
console.log('Add to .env:');
console.log('  JWT_MCP_PRIVATE_KEY_PATH=keys/mcp.private.pem');
console.log('  JWT_MCP_PUBLIC_KEY_PATH=keys/mcp.public.pem');
