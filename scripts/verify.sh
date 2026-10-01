#!/usr/bin/env bash
set -euo pipefail

CONTAINER="${MESHCENTRAL_CONTAINER:-meshcentral}"

check() {
  local description="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    printf 'OK  %s\n' "$description"
  else
    printf 'FAIL %s\n' "$description"
    return 1
  fi
}

fail=0

check "container is running" docker inspect -f '{{.State.Running}}' "$CONTAINER" || fail=1

check "custom consent module installed"   docker exec "$CONTAINER" sh -c "grep -q \"require('win-userconsent-defaultchecked')\" /opt/meshcentral/meshcentral/agents/meshcore.js" || fail=1

check "custom privacy-bar module installed"   docker exec "$CONTAINER" sh -c "grep -q \"require('notifybar-desktop-custom')\" /opt/meshcentral/meshcentral/agents/meshcore.js" || fail=1

check "Romanian consent labels installed"   docker exec "$CONTAINER" sh -c "grep -q \"'Permite'\" /opt/meshcentral/meshcentral/agents/meshcore.js && grep -q \"'Refuză'\" /opt/meshcentral/meshcentral/agents/meshcore.js" || fail=1

check "Windows session tracker installed"   docker exec "$CONTAINER" sh -c "grep -q \"require('win-session-state-tracker')\" /opt/meshcentral/meshcentral/agents/meshcore.js" || fail=1

check "session timeline server command installed"   docker exec "$CONTAINER" sh -c "grep -q 'serverCommandSessionTimeline' /opt/meshcentral/meshcentral/meshuser.js" || fail=1

check "session timeline UI installed"   docker exec "$CONTAINER" sh -c "grep -R -q 'User Session State' /opt/meshcentral/meshcentral/views" || fail=1

if [ "$fail" -ne 0 ]; then
  echo
  echo "One or more checks failed."
  exit 1
fi

echo
echo "All MeshCentral custom checks passed."
