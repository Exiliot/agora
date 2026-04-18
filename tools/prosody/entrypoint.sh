#!/bin/sh
# Generate the runtime Prosody config by substituting the domain into the
# template. PROSODY_DOMAIN is provided per instance in docker-compose.
set -eu

: "${PROSODY_DOMAIN:=server-a}"
: "${PROSODY_MUC_DOMAIN:=rooms.${PROSODY_DOMAIN}}"
: "${PROSODY_AUTH_URL:=http://api:3000/internal/xmpp/auth}"

# sed -i isn't always available on scratch images; do it the portable way.
sed \
  -e "s|@@DOMAIN@@|${PROSODY_DOMAIN}|g" \
  -e "s|@@MUC_DOMAIN@@|${PROSODY_MUC_DOMAIN}|g" \
  -e "s|@@AUTH_URL@@|${PROSODY_AUTH_URL}|g" \
  /etc/prosody/prosody.cfg.lua.tmpl > /etc/prosody/prosody.cfg.lua

echo "[entrypoint] Prosody configured for domain=${PROSODY_DOMAIN}"
exec prosody
