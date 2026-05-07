-- FinTS notification kinds (Phase 14a.7)
-- Reauth watcher and BLZ-refresh scheduler enqueue notifications via the
-- existing notifications module; new kinds gate per-channel templates.

ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'FINTS_REAUTH_WARNING';
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'FINTS_REAUTH_REQUIRED';
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'FINTS_SYNC_FAILED';
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'FINTS_BALANCE_DRIFT';
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'FINTS_BLZ_REGISTRY_STALE';
