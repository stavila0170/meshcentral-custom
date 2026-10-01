#!/usr/bin/env python3
import argparse
import json
import shutil
import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = ROOT / ".env"
CONFIG_FILE = ROOT / "data" / "config.json"

def read_env(path: Path):
    values = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
            value = value[1:-1]
        values[key] = value
    return values

def as_bool(value, default=False):
    if value is None:
        return default
    return value.strip().lower() in ("1", "true", "yes", "on")

def require(values, key):
    value = values.get(key, "").strip()
    if not value:
        raise SystemExit(f"ERROR: {key} is missing in .env")
    return value

def main():
    parser = argparse.ArgumentParser(description="Generate MeshCentral config.json from .env")
    parser.add_argument("--force", action="store_true", help="Replace an existing config.json after creating a backup")
    args = parser.parse_args()

    if not ENV_FILE.exists():
        raise SystemExit("ERROR: .env does not exist. Copy .env.example to .env first.")

    values = read_env(ENV_FILE)

    hostname = require(values, "MESHCENTRAL_HOSTNAME")
    if hostname == "CHANGE_ME_TO_SERVER_IP_OR_DNS":
        raise SystemExit("ERROR: Set MESHCENTRAL_HOSTNAME in .env")

    mongo_user = require(values, "MONGO_USERNAME")
    mongo_pass = require(values, "MONGO_PASSWORD")
    if mongo_pass == "CHANGE_ME_TO_A_LONG_RANDOM_PASSWORD":
        raise SystemExit("ERROR: Replace the placeholder MONGO_PASSWORD in .env")

    https_port = int(values.get("MESHCENTRAL_HTTPS_PORT", "4434"))
    mps_port = int(values.get("MESHCENTRAL_MPS_PORT", "4433"))
    title = values.get("MESHCENTRAL_TITLE", "MeshCentral").strip() or "MeshCentral"
    allow_new_accounts = as_bool(values.get("MESHCENTRAL_ALLOW_NEW_ACCOUNTS"), True)

    if CONFIG_FILE.exists():
        if not args.force:
            print(f"Existing config preserved: {CONFIG_FILE}")
            print("Use --force only when you intentionally want to regenerate it.")
            return
        backup = CONFIG_FILE.with_name(
            f"config.json.bak-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
        )
        shutil.copy2(CONFIG_FILE, backup)
        print(f"Backup created: {backup}")

    CONFIG_FILE.parent.mkdir(parents=True, exist_ok=True)

    mongo_url = (
        "mongodb://"
        + quote(mongo_user, safe="")
        + ":"
        + quote(mongo_pass, safe="")
        + "@mongo:27017/meshcentral?authSource=admin"
    )

    allowed_origins = []
    for item in (hostname, "localhost", "127.0.0.1"):
        if item and item not in allowed_origins:
            allowed_origins.append(item)

    config = {
        "$schema": "https://raw.githubusercontent.com/Ylianst/MeshCentral/master/meshcentral-config-schema.json",
        "settings": {
            "cert": hostname,
            "WANonly": True,
            "port": 443,
            "aliasPort": https_port,
            "redirPort": 0,
            "mpsPort": mps_port,
            "mongoDb": mongo_url,
            "plugins": {
                "enabled": True
            }
        },
        "domains": {
            "": {
                "title": title,
                "minify": False,
                "newAccounts": allow_new_accounts,
                "allowedOrigin": allowed_origins,
                "softwareInventory": True,
                "localSessionRecording": True,
                "consentMessages": {
                    "Title": "Asistență IT",
                    "Desktop": "Tehnicianul IT {0} solicită conectarea la calculatorul dumneavoastră pentru asistență tehnică. Permiteți accesul?",
                    "Terminal": "Tehnicianul IT {0} solicită acces la linia de comandă pentru diagnosticare. Permiteți accesul?",
                    "Files": "Tehnicianul IT {0} solicită acces la fișiere pentru efectuarea intervenției tehnice. Permiteți accesul?",
                    "consentTimeout": 60,
                    "autoAcceptOnTimeout": False,
                    "autoAcceptIfNoUser": False,
                    "oldStyle": False
                },
                "desktopPrivacyBarText": "Partajare: {0}"
            }
        }
    }

    CONFIG_FILE.write_text(
        json.dumps(config, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8"
    )

    print(f"Generated: {CONFIG_FILE}")
    print(f"  cert/hostname : {hostname}")
    print(f"  HTTPS alias   : {https_port}")
    print(f"  MPS port      : {mps_port}")
    print("  MongoDB       : enabled")
    print(f"  allowedOrigin : {', '.join(allowed_origins)}")

if __name__ == "__main__":
    main()
