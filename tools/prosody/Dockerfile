# Build Prosody on Debian so we can control the Lua module path precisely.
# Image is configured at runtime by entrypoint.sh using PROSODY_DOMAIN.

FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
      prosody \
      ca-certificates \
      curl \
      lua-sec \
      lua-socket \
      lua-expat \
      lua-filesystem \
  && rm -rf /var/lib/apt/lists/*

# Community module: mod_auth_http — synchronous HTTP POST for credential check.
RUN mkdir -p /usr/lib/prosody/modules-community \
  && curl -fsSL -o /usr/lib/prosody/modules-community/mod_auth_http.lua \
      "https://hg.prosody.im/prosody-modules/raw-file/tip/mod_auth_http/mod_auth_http.lua"

COPY prosody.cfg.lua.tmpl /etc/prosody/prosody.cfg.lua.tmpl
COPY entrypoint.sh /usr/local/bin/prosody-entry
RUN chmod +x /usr/local/bin/prosody-entry \
  && mkdir -p /var/lib/prosody /var/log/prosody /var/run/prosody \
  && chown -R prosody:prosody /var/lib/prosody /var/log/prosody /var/run/prosody /etc/prosody

USER prosody
EXPOSE 5222 5269
ENTRYPOINT ["/usr/local/bin/prosody-entry"]
