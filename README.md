# MeshCentral Custom

Custom Docker build of [MeshCentral](https://github.com/Ylianst/MeshCentral) that packages the modifications used in the current deployment in a reproducible way.

## Current baseline

- MeshCentral base image: `ghcr.io/ylianst/meshcentral:1.2.1`
- Deployment: Docker Compose
- Database: MongoDB
- Repository status: bootstrap complete; exact known-working server files still need to be imported before the first release

## Included customizations

The working deployment currently contains:

- Windows user-consent customization
  - Romanian buttons: **Permite / Refuză**
  - **Auto accept all connections for next 5 minutes** checked by default
- Remote desktop privacy-bar customization
  - compact custom behavior
  - automatic minimized/compact state
- Windows session-state tracker
  - `LOCKED`
  - `UNLOCKED`
  - `NOUSER`
- A second **User Session State** timeline on the device **General** page
- Timeline patching for normal and translated Handlebars templates

## Project goal

The goal is to make this customized MeshCentral installation easy to deploy and update on other servers using Git and Docker.

Once the exact tested files are imported, the intended workflow will be:

```bash
git clone https://github.com/stavila0170/meshcentral-custom.git
cd meshcentral-custom
cp .env.example .env
# edit .env
docker compose up -d
```

Updates will later be reduced to:

```bash
git pull
docker compose pull
docker compose up -d
```

or to a prebuilt image from GitHub Container Registry.

## Repository layout

```text
meshcentral-custom/
├── README.md
├── .gitignore
├── .env.example
├── custom/
│   └── README.md
├── scripts/
│   └── README.md
└── .github/
    └── workflows/
```

The production versions of the custom JavaScript files and `compose.yaml` will be imported from the currently working server instead of being reconstructed.

## Security

Never commit production secrets or persistent runtime data.

The following stay only on the server:

- `.env`
- `data/`
- `db/`
- `files/`
- `backups/`
- TLS certificates/private keys
- MongoDB passwords
- MeshCentral session/login secrets

Use `.env.example` only as a template.

## Upstream compatibility

Where a customization becomes available in upstream MeshCentral, this repository should prefer the official setting and remove the corresponding patch.

For example, newer MeshCentral versions include the official `desktopPrivacyBarMaxWidth` domain option. The current 1.2.1-based deployment still needs its existing custom handling until the base version is upgraded and tested.

## License

Custom code in this repository is intended to be distributed under the Apache License 2.0. MeshCentral remains the project of its upstream authors and is governed by its upstream license.
