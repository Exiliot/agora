# Prosody with the `auth_http_async` community module baked in so we can
# delegate credential validation back to the agora api at runtime.

FROM prosody/prosody:0.12

USER root
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl lua-sec lua-socket \
  && rm -rf /var/lib/apt/lists/*

# Pull the community auth_http_async module (HG mirror on GitHub).
RUN mkdir -p /usr/lib/prosody/modules-community \
  && curl -sSL -o /usr/lib/prosody/modules-community/mod_auth_http_async.lua \
      https://raw.githubusercontent.com/bjc/prosody-modules/main/mod_auth_http_async/mod_auth_http_async.lua \
      || echo 'community module fetch failed — will need manual install'

COPY prosody.cfg.lua /etc/prosody/prosody.cfg.lua

USER prosody
EXPOSE 5222 5269 5280
CMD ["prosody"]
