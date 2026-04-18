#!/bin/sh
# Generate the runtime Prosody config by substituting the domain into the
# template. PROSODY_DOMAIN is provided per instance in docker-compose.
set -eu

: "${PROSODY_DOMAIN:=server-a}"
: "${PROSODY_MUC_DOMAIN:=rooms.${PROSODY_DOMAIN}}"
: "${PROSODY_AUTH_URL:=http://api:3000/internal/xmpp/auth}"

sed \
  -e "s|@@DOMAIN@@|${PROSODY_DOMAIN}|g" \
  -e "s|@@MUC_DOMAIN@@|${PROSODY_MUC_DOMAIN}|g" \
  -e "s|@@AUTH_URL@@|${PROSODY_AUTH_URL}|g" \
  /etc/prosody/prosody.cfg.lua.tmpl > /etc/prosody/prosody.cfg.lua

# Self-signed cert for the virtual host. Required because @xmpp/client
# (and most XMPP clients) won't present SASL PLAIN over plaintext. The cert
# only needs to exist — we're not validating it in the demo network.
CERT_DIR="/var/lib/prosody/certs"
CERT="${CERT_DIR}/${PROSODY_DOMAIN}.crt"
KEY="${CERT_DIR}/${PROSODY_DOMAIN}.key"
mkdir -p "${CERT_DIR}"
if [ ! -f "${CERT}" ]; then
  openssl req -x509 -newkey rsa:2048 -nodes \
    -subj "/CN=${PROSODY_DOMAIN}" \
    -addext "subjectAltName=DNS:${PROSODY_DOMAIN},DNS:${PROSODY_MUC_DOMAIN}" \
    -days 3650 \
    -keyout "${KEY}" -out "${CERT}" >/dev/null 2>&1
fi

echo "[entrypoint] Prosody configured for domain=${PROSODY_DOMAIN}"
exec prosody
