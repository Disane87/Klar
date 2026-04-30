import { generateKeyPairSync } from 'node:crypto';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const keysDir = join(process.cwd(), 'keys');
const privateKeyPath = join(keysDir, 'private.pem');
const publicKeyPath = join(keysDir, 'public.pem');

if (existsSync(privateKeyPath) && existsSync(publicKeyPath)) {
  console.log('Keys already exist — skipping. Delete keys/ to regenerate.');
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

console.log('✓ JWT RS256 key pair generated:');
console.log('  keys/private.pem  (mode 0600 — keep secret)');
console.log('  keys/public.pem');
console.log('');
console.log('Add to .env:');
console.log('  JWT_PRIVATE_KEY_PATH=keys/private.pem');
console.log('  JWT_PUBLIC_KEY_PATH=keys/public.pem');
