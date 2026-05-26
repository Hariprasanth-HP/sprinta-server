#!/usr/bin/env bash
set -e

REDIS_SERVER="$HOME/bin/redis-server"
REDIS_CLI="$HOME/bin/redis-cli"

echo "Starting Redis..."
$REDIS_SERVER --daemonize yes

trap 'echo "Stopping Redis..."; $REDIS_CLI shutdown' EXIT

pnpm run dev
