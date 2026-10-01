# Custom MeshCentral files

This directory will contain the exact files copied from the known-working server.

Expected files:

- `win-userconsent-defaultchecked.js`
- `notifybar-desktop.js`
- `win-session-state-tracker.js`
- `patch-session-timeline.js`

## Rule for production migration

Do not reconstruct these files from documentation when preparing a release.

The first production commit should use the exact tested copies from:

```text
/home/stavilav/docker-sites/meshcentral/custom/
```

After that, all changes should be versioned through Git.
