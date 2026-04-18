resource "oci_core_vcn" "agora" {
  compartment_id = var.compartment_ocid
  cidr_blocks    = ["10.0.0.0/16"]
  display_name   = "agora-vcn"
  dns_label      = "agora"
}

resource "oci_core_internet_gateway" "agora" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.agora.id
  display_name   = "agora-ig"
  enabled        = true
}

resource "oci_core_route_table" "agora" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.agora.id
  display_name   = "agora-rt"

  route_rules {
    network_entity_id = oci_core_internet_gateway.agora.id
    destination       = "0.0.0.0/0"
    destination_type  = "CIDR_BLOCK"
  }
}

resource "oci_core_security_list" "agora" {
  compartment_id = var.compartment_ocid
  vcn_id         = oci_core_vcn.agora.id
  display_name   = "agora-sl"

  egress_security_rules {
    destination = "0.0.0.0/0"
    protocol    = "all"
  }

  # SSH
  ingress_security_rules {
    protocol = "6" # TCP
    source   = "0.0.0.0/0"
    tcp_options {
      min = 22
      max = 22
    }
  }

  # HTTP (reserved for a future reverse proxy)
  ingress_security_rules {
    protocol = "6"
    source   = "0.0.0.0/0"
    tcp_options {
      min = 80
      max = 80
    }
  }

  # HTTPS (reserved for a future reverse proxy)
  ingress_security_rules {
    protocol = "6"
    source   = "0.0.0.0/0"
    tcp_options {
      min = 443
      max = 443
    }
  }

  # Agora web container – direct exposure until TLS/reverse-proxy lands
  ingress_security_rules {
    protocol = "6"
    source   = "0.0.0.0/0"
    tcp_options {
      min = 8080
      max = 8080
    }
  }
}

resource "oci_core_subnet" "agora" {
  compartment_id    = var.compartment_ocid
  vcn_id            = oci_core_vcn.agora.id
  cidr_block        = "10.0.1.0/24"
  display_name      = "agora-subnet"
  dns_label         = "public"
  route_table_id    = oci_core_route_table.agora.id
  security_list_ids = [oci_core_security_list.agora.id]
}
