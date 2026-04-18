# terraform/ – demo deploy to Oracle Cloud Always Free

Optional path for putting agora on a public URL without spending anything.
**Not the delivery contract** – `docker compose up` at the repo root is still
the canonical way to run agora (see `../CLAUDE.md`). This folder only exists
to make "someone open the link and it works" convenient for a test group.

## What it builds

One Ampere A1 Flex VM (2 OCPU / 12 GB, within Always Free caps), a VCN with
a public subnet and a security list that opens 22 / 80 / 443 / 8080, plus a
cloud-init script that installs Docker, clones the repo, and runs
`docker compose up -d`.

Output is a public IP and a URL; opening the URL hits the stack directly on
port 8080 – no TLS yet. Add Caddy in front if you want HTTPS.

## Prereqs on your machine

- `terraform` ≥ 1.5 (`brew install terraform`)
- `oci` CLI with a working `~/.oci/config` (`oci setup config` does it end to
  end: generates the API key, uploads the public half to your Oracle account,
  writes the local config file). Verify with `oci iam region list`.
- An SSH key pair you're happy to use on the VM (`~/.ssh/id_ed25519`).

## First-time run

```sh
cd terraform
cp terraform.tfvars.example terraform.tfvars
# edit terraform.tfvars – paste your tenancy OCID, compartment OCID
# (same as tenancy for a demo), region, and SSH public key

terraform init
terraform apply
```

After `apply` finishes you get three outputs:

```
public_ip = "X.X.X.X"
url       = "http://X.X.X.X:8080"
ssh       = "ssh ubuntu@X.X.X.X"
```

The VM is created in under a minute but cloud-init keeps going (Docker
install + `docker compose up --build`). Give it ~3 minutes, or block on it
explicitly:

```sh
ssh ubuntu@$(terraform output -raw public_ip) 'sudo cloud-init status --wait'
```

Then open the `url` output in a browser.

## Teardown

```sh
terraform destroy
```

Everything this folder created disappears. Nothing about the agora source
tree changes.

## Troubleshooting

- **`Out of host capacity` on apply**. Oracle's ARM shape is often saturated.
  Re-run with `-var ad_index=1` (or `2`) to try the other availability
  domains in your region. If all three are empty, either switch region
  (`-var region=eu-amsterdam-1` etc.) or fall back to the AMD Always Free
  shape: set `instance_shape = "VM.Standard.E2.1.Micro"` in
  `terraform.tfvars` (you'll also want `instance_ocpus` / `instance_memory_gb`
  removed – the E2 Micro shape is fixed, not flex).
- **Browser can reach the IP but the page doesn't load** after 3 minutes.
  SSH in and check `sudo tail -n 100 /var/log/cloud-init-output.log`. The
  most common cause is docker buildkit running out of memory on the build of
  `web` – bump `instance_memory_gb` to 16 or 24.
- **`terraform apply` fails on provider auth**. `oci iam region list` is the
  cleaner test; if that fails your `~/.oci/config` isn't reachable. Check
  `OCI_CLI_PROFILE` if you use a non-default profile.

## Going further

- **TLS**. Register a domain, point an A record at the `public_ip`, add a
  Caddy sidecar to `docker-compose.yml` that reverse-proxies the `web`
  container on 443. Caddy handles Let's Encrypt itself.
- **Persistent attachments across re-apply**. Attach an Always Free block
  volume (200 GB aggregate cap) and mount it at `/home/ubuntu/agora/storage`
  before `docker compose up`. Destroying the VM won't take the volume with
  it.
