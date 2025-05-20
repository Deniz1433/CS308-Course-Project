resource "kubernetes_secret" "db_creds" {
  metadata {
    name      = "db-creds"
    namespace = "default"
  }

  data = {
    username = var.db_user
    password = var.db_password
  }
}

resource "kubernetes_secret" "backend_app_secret" {
  metadata {
    name      = "backend-app-secret"
    namespace = "default"
  }

  data = {
    session_secret  = var.session_secret
    mailgun_api_key = var.mailgun_api_key
  }
}

resource "kubernetes_deployment" "backend" {
  metadata {
    name   = "backend"
    labels = { app = "backend" }
  }

  spec {
    replicas = 2

    selector {
      match_labels = { app = "backend" }
    }

    template {
      metadata {
        labels = { app = "backend" }
      }

      spec {
        container {
          name  = "backend"
          image = "europe-west1-docker.pkg.dev/zinc-mantra-460321-t3/repo/backend:latest"

          port { container_port = 5000 }

          # ← resource requests & limits
          resources {
            requests = {
              cpu    = "100m"
              memory = "128Mi"
            }
            limits = {
              cpu    = "500m"
              memory = "512Mi"
            }
          }

          # non-secret envs
          env {
            name  = "DB_HOST"
            value = google_compute_instance.mysql_vm.network_interface[0].network_ip
          }
          env {
            name  = "DB_NAME"
            value = var.db_name
          }
          env {
            name  = "NODE_ENV"
            value = var.node_env
          }

          # DB creds from Secret
          env {
            name = "DB_USER"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.db_creds.metadata[0].name
                key  = "username"
              }
            }
          }
          env {
            name = "DB_PASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.db_creds.metadata[0].name
                key  = "password"
              }
            }
          }

          # session & API key from Secret
          env {
            name = "SESSION_SECRET"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.backend_app_secret.metadata[0].name
                key  = "session_secret"
              }
            }
          }
          env {
            name = "MAILGUN_API_KEY"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.backend_app_secret.metadata[0].name
                key  = "mailgun_api_key"
              }
            }
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "backend" {
  metadata { name = "backend-service" }

  spec {
    selector = { app = "backend" }

    port {
      port        = 5000
      target_port = 5000
    }

    type = "LoadBalancer"
	
	session_affinity = "ClientIP"
  }
}

resource "kubernetes_deployment" "frontend" {
  metadata {
    name   = "frontend"
    labels = { app = "frontend" }
  }

  spec {
    replicas = 2

    selector {
      match_labels = { app = "frontend" }
    }

    template {
      metadata {
        labels = { app = "frontend" }
      }

      spec {
        container {
          name  = "frontend"
          image = "europe-west1-docker.pkg.dev/zinc-mantra-460321-t3/repo/frontend-prod:latest"

          port { container_port = 80 }

          resources {
            requests = {
              cpu    = "250m"
              memory = "512Mi"
            }
            limits = {
              cpu    = "1000m"
              memory = "1Gi"
            }
          }

          env {
            name  = "CHOKIDAR_USEPOLLING"
            value = "true"
          }
          env {
            name  = "DANGEROUSLY_DISABLE_HOST_CHECK"
            value = tostring(var.dangerously_disable_host_check)
          }
		  env {
            name  = "HOST"
            value = "0.0.0.0"
          }
		  env {
            name  = "PORT"
            value = "3000"
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "frontend" {
  metadata { name = "frontend-service" }

  spec {
    selector = { app = "frontend" }

    port {
      port        = 3000
      target_port = 80
    }

    type = "LoadBalancer"
  }
}
