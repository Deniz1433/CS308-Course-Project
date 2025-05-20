variable "project_id" {
  type        = string
  description = "GCP project ID"
}

variable "region" {
  type        = string
  default     = "europe-west1"
}

variable "zone" {
  type        = string
  default     = "europe-west1-b"
}

variable "mysql_root_password" {
  type        = string
  description = "MySQL root password"
  sensitive   = true
}

variable "db_host" {
  type        = string
  description = "Database host for backend"
  default     = "mysql"  # you can override
}

variable "db_user" {
  type        = string
  description = "Database user for backend"
  default     = "root"
}

variable "db_password" {
  type        = string
  description = "Database password for backend"
  sensitive   = true
}

variable "db_name" {
  type        = string
  description = "Database name"
  default     = "ecommerce"
}

variable "session_secret" {
  type        = string
  description = "Backend session secret"
  default     = "secret123"
  sensitive   = true
}

variable "node_env" {
  type        = string
  description = "Backend node environment"
  default     = "development"
}

variable "mailgun_api_key" {
  type        = string
  description = "Mailgun API key"
  default     = ""
  sensitive   = true
}

variable "mailgun_domain" {
  type        = string
  description = "Mailgun domain"
  default     = ""
  sensitive   = true
}

variable "email_from" {
  type        = string
  description = "Email from address"
  default     = ""
  sensitive   = true
}

variable "dangerously_disable_host_check" {
  type        = bool
  description = "Frontend dangerous host check"
  default     = true
}
