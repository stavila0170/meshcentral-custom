#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-compose.ghcr.yaml}"

docker compose -f "$COMPOSE_FILE" pull meshcentral
docker compose -f "$COMPOSE_FILE" up -d

echo
echo "Update complete."
docker compose -f "$COMPOSE_FILE" ps
