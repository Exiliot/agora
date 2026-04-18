variable "tenancy_ocid" {
  description = "Tenancy OCID. Shown at the top of any OCI console page under 'Tenancy details'."
  type        = string
}

variable "compartment_ocid" {
  description = "Compartment to put resources in. Root compartment is fine for a demo; use the tenancy OCID for that."
  type        = string
}

variable "region" {
  description = "OCI region, e.g. uk-london-1, eu-frankfurt-1, eu-amsterdam-1. These three usually have ARM capacity."
  type        = string
}

variable "ssh_public_key" {
  description = "Contents of your SSH public key (e.g. ~/.ssh/id_ed25519.pub). Paste the full line including the ssh-ed25519 or ssh-rsa prefix."
  type        = string
}

variable "ad_index" {
  description = "Availability domain index (0, 1 or 2) to pick from the region's list. Bump this if the first AD returns 'Out of host capacity'."
  type        = number
  default     = 0
}

variable "instance_shape" {
  description = "Compute shape. Default is Always Free ARM (Ampere A1)."
  type        = string
  default     = "VM.Standard.A1.Flex"
}

variable "instance_ocpus" {
  description = "OCPU count for the A1 Flex shape. Always Free cap is 4 across all A1 instances in the tenancy."
  type        = number
  default     = 2
}

variable "instance_memory_gb" {
  description = "Memory in GB. Always Free cap is 24 across all A1 instances in the tenancy. Ratio ~6 GB per OCPU is a fine default."
  type        = number
  default     = 12
}

variable "repo_url" {
  description = "Git repo cloud-init should clone into the VM."
  type        = string
  default     = "https://github.com/Exiliot/agora.git"
}

variable "repo_branch" {
  description = "Branch to check out."
  type        = string
  default     = "main"
}
