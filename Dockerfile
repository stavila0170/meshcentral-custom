ARG MESHCENTRAL_VERSION=1.2.1
FROM ghcr.io/ylianst/meshcentral:${MESHCENTRAL_VERSION}

COPY custom/win-userconsent-defaultchecked.js \
  /opt/meshcentral/meshcentral/agents/modules_meshcore/win-userconsent-defaultchecked.js

RUN sed -i \
  "s/require('win-userconsent')/require('win-userconsent-defaultchecked')/g" \
  /opt/meshcentral/meshcentral/agents/meshcore.js \
  && grep -q "require('win-userconsent-defaultchecked')" \
  /opt/meshcentral/meshcentral/agents/meshcore.js

COPY custom/notifybar-desktop.js \
  /opt/meshcentral/meshcentral/agents/modules_meshcore/notifybar-desktop-custom.js

RUN sed -i \
  "s/require('notifybar-desktop')/require('notifybar-desktop-custom')/g" \
  /opt/meshcentral/meshcentral/agents/meshcore.js \
  && grep -q "require('notifybar-desktop-custom')" \
  /opt/meshcentral/meshcentral/agents/meshcore.js

RUN sed -i \
  "s/currentTranslation\['allow'\]/'Permite'/g; \
  s/currentTranslation\['deny'\]/'Refuză'/g" \
  /opt/meshcentral/meshcentral/agents/meshcore.js \
  && grep -q "'Permite'" \
  /opt/meshcentral/meshcentral/agents/meshcore.js \
  && grep -q "'Refuză'" \
  /opt/meshcentral/meshcentral/agents/meshcore.js

COPY custom/win-session-state-tracker.js \
  /opt/meshcentral/meshcentral/agents/modules_meshcore/win-session-state-tracker.js

RUN sed -i \
  "/var promise = require('promise');/a try { require('win-session-state-tracker'); } catch (ex) { }" \
  /opt/meshcentral/meshcentral/agents/meshcore.js \
  && grep -q "require('win-session-state-tracker')" \
  /opt/meshcentral/meshcentral/agents/meshcore.js

COPY custom/patch-session-timeline.js /tmp/patch-session-timeline.js

RUN node /tmp/patch-session-timeline.js \
  && rm /tmp/patch-session-timeline.js
