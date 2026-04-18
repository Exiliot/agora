output "public_ip" {
  description = "Public IPv4 of the agora instance."
  value       = oci_core_instance.agora.public_ip
}

output "url" {
  description = "Open this in a browser after cloud-init finishes (give it ~3 minutes after apply)."
  value       = "http://${oci_core_instance.agora.public_ip}:8080"
}

output "ssh" {
  description = "SSH in to check logs or cloud-init status."
  value       = "ssh ubuntu@${oci_core_instance.agora.public_ip}"
}

output "cloud_init_status_cmd" {
  description = "Blocks until cloud-init has fully finished provisioning (docker install + compose up)."
  value       = "ssh ubuntu@${oci_core_instance.agora.public_ip} 'sudo cloud-init status --wait'"
}
