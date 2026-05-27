/**
 * Generate a VAPID key pair for Web Push (RFC 8030/8291).
 *
 * Run via `pnpm --filter @klar/api vapid:generate`. Prints the keys to
 * stdout — paste them into your `.env` as VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY.
 * Existing keys are not overwritten; rotation requires manual replacement
 * (all push subscriptions become invalid after rotation).
 */
import webPush from 'web-push';

const keys = webPush.generateVAPIDKeys();
console.log('# Paste into apps/api/.env (or your secrets manager):');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log('VAPID_SUBJECT=mailto:admin@your-klar-instance.com');
