import 'reflect-metadata';
import * as path from 'path';
import * as fs from 'fs';

// Load .env explicitly with absolute path so ConfigModule.forRoot() always finds it.
// Vitest fork mode may change process.cwd(), making relative dotenv paths unreliable.
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

// Remap JWT key paths to absolute paths so fs.readFileSync works from any cwd
const apiRoot = path.resolve(__dirname, '..');
if (process.env['JWT_PRIVATE_KEY_PATH'] && !path.isAbsolute(process.env['JWT_PRIVATE_KEY_PATH'])) {
  process.env['JWT_PRIVATE_KEY_PATH'] = path.resolve(apiRoot, process.env['JWT_PRIVATE_KEY_PATH']);
}
if (process.env['JWT_PUBLIC_KEY_PATH'] && !path.isAbsolute(process.env['JWT_PUBLIC_KEY_PATH'])) {
  process.env['JWT_PUBLIC_KEY_PATH'] = path.resolve(apiRoot, process.env['JWT_PUBLIC_KEY_PATH']);
}

// Always use the test database for E2E tests
if (process.env['DATABASE_TEST_URL']) {
  process.env['DATABASE_URL'] = process.env['DATABASE_TEST_URL'];
}
