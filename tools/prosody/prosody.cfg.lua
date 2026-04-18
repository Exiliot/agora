-- Prosody configuration for the agora Phase 2 spike.
-- HTTP auth delegates credential validation to the agora api.
-- TLS is disabled for the spike (HTTP c2s on localhost); federation would
-- require a proper CA.

admins = { }

modules_enabled = {
  "roster";
  "saslauth";
  "tls";
  "dialback";
  "disco";
  "private";
  "vcard";
  "version";
  "uptime";
  "time";
  "ping";
  "register";
  "admin_adhoc";
  "muc_mam";
  "http";
  "bosh";
  "websocket";
  "auth_http_async";  -- community module, provides HTTP auth
}

modules_disabled = {
  "s2s";  -- federation disabled in the spike; enabled in federation topology
}

allow_registration = false

-- External HTTP authentication — Prosody asks agora to validate credentials.
http_auth_url = "http://api:3000/internal/xmpp/auth"

-- Listen on all interfaces; compose maps ports.
interfaces = { "*" }
c2s_ports = { 5222 }
s2s_ports = { 5269 }
http_ports = { 5280 }

-- Disable SSL for the local spike (do not copy this to production).
c2s_require_encryption = false
s2s_require_encryption = false
authentication = "http_async"

log = {
  { levels = { min = "info" }, to = "console" };
}

pidfile = "/var/run/prosody/prosody.pid"

-- Virtual host: one local domain for the spike.
VirtualHost "agora.test"
  authentication = "http_async"
  -- Components that run alongside the VirtualHost:
  Component "rooms.agora.test" "muc"
    modules_enabled = { "muc_mam" }
