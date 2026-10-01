#!/usr/bin/env bash
set -euo pipefail

COMPOSE_FILE="${COMPOSE_FILE:-compose.ghcr.yaml}"

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: Docker is not installed or not in PATH."
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "ERROR: python3 is required to generate data/config.json."
  exit 1
fi

if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "Created .env from .env.example."
  echo "Edit .env and replace MESHCENTRAL_HOSTNAME and MONGO_PASSWORD before continuing."
  exit 2
fi

if grep -q "CHANGE_ME_TO_SERVER_IP_OR_DNS" .env; then
  echo "ERROR: Edit .env and set MESHCENTRAL_HOSTNAME to the IP address or DNS name used in your browser."
  exit 2
fi

if grep -q "CHANGE_ME_TO_A_LONG_RANDOM_PASSWORD" .env; then
  echo "ERROR: Edit .env and replace the placeholder MongoDB password."
  exit 2
fi

mkdir -p data db files backups

python3 scripts/generate-config.py

docker compose -f "$COMPOSE_FILE" pull
docker compose -f "$COMPOSE_FILE" up -d

echo
echo "MeshCentral custom deployment started."
docker compose -f "$COMPOSE_FILE" ps
