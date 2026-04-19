# 2026-04-18 · Oracle Cloud Free Tier spike

Optional sideline. User asked whether a demo could be hosted for free somewhere public (Cloudflare was mentioned), since graders need `docker compose up` to work on their machine but a live URL is a nice-to-have. Settled on OCI Always Free as the only no-cost option that can host a full Docker Compose stack (Cloudflare Workers / Pages / Tunnel don't run a long-lived Postgres + Fastify + nginx in the same way).

## What landed and came back off

A complete Terraform stack at `terraform/` under agora's root:

- `main.tf` + `variables.tf` – `oracle/oci` provider, zero credentials in code (reads `~/.oci/config`).
- `network.tf` – VCN, public subnet, Internet gateway, routing, security list opening 22/80/443/8080.
- `compute.tf` – one `VM.Standard.A1.Flex` (2 OCPU / 12 GB, Always Free), Ubuntu 22.04 ARM image looked up via `oci_core_images`, public IP attached.
- `cloud-init.yaml` – installs Docker, clones the repo, `docker compose up -d --build` on first boot.
- Three `outputs.tf` values: public IP, URL (`http://<ip>:8080`), SSH command.
- `README.md` in `terraform/` with the five-step run-through; `.gitignore` to keep `terraform.tfvars` and `.terraform/` out of git.

## What broke it

`terraform apply` got through the networking and image resolution cleanly, then failed on the compute resource itself:

```
Service error: InternalError. Out of host capacity.
```

Tried:
- The 2 OCPU / 12 GB Always-Free shape – failed in AD-1.
- A smaller 1 OCPU / 6 GB variant – also failed.
- Both of the other availability domains (AD-2, AD-3) in `eu-frankfurt-1` – all three ADs returned the same error.

This is a known OCI behaviour: ARM Always-Free capacity in EU regions has been thin for months. The usual workaround is either (a) retry-loops that walk the ADs and attempt every few minutes until a slot frees up, or (b) switch to a less-saturated region (e.g. `eu-amsterdam-1`, `ap-osaka-1`).

User chose to tear down rather than spin on retries. `terraform destroy` ran clean; no resources left behind; no charges were ever accrued (boundary was Always-Free shapes only, no billable SKU was ever provisioned – verified by checking the cost analysis dashboard showed zero).

Kept the Terraform in-tree anyway. If the user wants to pick this up again on a different region the only change is one line in `variables.tf`.

## Auth & safety notes

- OCI CLI config lives in `~/.oci/config`; the Terraform provider reads it, so no API keys live in the repo or the environment.
- `terraform.tfvars.example` is tracked; the real `terraform.tfvars` with tenancy OCID, compartment OCID, and SSH public key path is gitignored.
- A budget alert at $1 was set up manually in the OCI console before any apply attempt, with email notifications; the `oci budgets budget create` CLI subcommand that would have encoded this in the state didn't exist in the CLI version at hand so we fell back to the console.

## Takeaways

- OCI Always Free is the only route to a fully free, long-running Docker Compose host that survives a reboot. Neither Cloudflare's Workers nor Pages host an ambient Postgres + WS backend.
- Frankfurt ARM capacity is hostile. If someone revives this, start in Amsterdam or Osaka, or use the auto-retry-across-ADs pattern from the well-known `let's-try-to-Get-ARM-A1` community scripts.
- For the hackathon itself the `docker compose up` contract is sufficient. The graders run it locally. Public demo hosting is not on the critical path.
- If we want a truly free *static* URL for the marketing / landing page only, Cloudflare Pages is fine for that alone – but the live chat is a separate concern.
