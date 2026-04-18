terraform {
  required_version = ">= 1.5.0"
  required_providers {
    oci = {
      source  = "oracle/oci"
      version = ">= 5.0.0"
    }
  }
}

# Credentials + region read automatically from ~/.oci/config (DEFAULT profile).
# To override, set TF_VAR_region / OCI_CLI_PROFILE etc.
provider "oci" {
  region = var.region
}

# First availability domain in the configured region. ARM capacity is
# usually spread across the three ADs; pick one at random and we let
# terraform fail fast if it's out. If that happens, re-run with
# `-var ad_index=1` or `-var ad_index=2`.
data "oci_identity_availability_domains" "ads" {
  compartment_id = var.tenancy_ocid
}

locals {
  ad_name = data.oci_identity_availability_domains.ads.availability_domains[var.ad_index].name
}
