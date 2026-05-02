#!/bin/sh
set -e

# Decode base64-encoded JWT keys from env vars (set once, persistent across restarts)
if [ -n "$JWT_PRIVATE_KEY" ]; then
  mkdir -p /app/keys
  printf '%s' "$JWT_PRIVATE_KEY" | base64 -d > /app/keys/private.pem
  export JWT_PRIVATE_KEY_PATH=/app/keys/private.pem
fi

if [ -n "$JWT_PUBLIC_KEY" ]; then
  mkdir -p /app/keys
  printf '%s' "$JWT_PUBLIC_KEY" | base64 -d > /app/keys/public.pem
  export JWT_PUBLIC_KEY_PATH=/app/keys/public.pem
fi

echo "Running database migrations..."
npx prisma migrate deploy --schema=/app/prisma/schema.prisma

exec "$@"
