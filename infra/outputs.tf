output "gke_cluster_name" {
  value = google_container_cluster.gke_cluster.name
}

output "gke_cluster_endpoint" {
  value = google_container_cluster.gke_cluster.endpoint
}

output "mysql_vm_ip" {
  value = google_compute_instance.mysql_vm.network_interface[0].access_config[0].nat_ip
}

output "backend_service_ip" {
  value = kubernetes_service.backend.status[0].load_balancer[0].ingress[0].ip
}

output "frontend_service_ip" {
  value = kubernetes_service.frontend.status[0].load_balancer[0].ingress[0].ip
}

output "newsletter_function_url" {
  description = "HTTPS trigger URL for sendNewsletter"
  value       = google_cloudfunctions_function.send_newsletter.https_trigger_url
}
