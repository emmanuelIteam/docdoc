terraform {
  required_providers {
    scaleway = {
      source  = "scaleway/scaleway"
      version = "~> 2.35"
    }
  }
}

provider "scaleway" {
  zone   = "fr-par-1"
  region = "fr-par"
}

# Récupère le projet par défaut, utilisé pour scoper la politique IAM
data "scaleway_account_project" "default" {}

# 1. Namespace Serverless Container
resource "scaleway_container_namespace" "main" {
  name        = "docdoc-namespace"
  description = "Namespace pour l'application Web docdoc"
}

# 2. Bucket Object Storage S3 pour stocker les fichiers JSON
resource "scaleway_object_bucket" "json_data" {
  name          = "docdoc-json-storage" # Le nom du bucket doit être unique
  region        = "fr-par"
  force_destroy = false # Empêche la suppression accidentelle si le bucket contient des données
}

# 3. Application IAM pour l'app Node.js (identité à laquelle la clé API est rattachée)
resource "scaleway_iam_application" "api" {
  name        = "docdoc-api"
  description = "Application pour l'accès S3 de l'application docdoc"
}

# 4. Politique IAM : accorde l'accès en lecture/écriture au Object Storage
#    à l'application, scopé sur le projet par défaut.
resource "scaleway_iam_policy" "s3" {
  name           = "docdoc-s3-policy"
  description    = "Accès S3 (lecture/écriture) pour l'application docdoc"
  application_id = scaleway_iam_application.api.id

  rule {
    project_ids          = [data.scaleway_account_project.default.id]
    permission_set_names = ["ObjectStorageFullAccess"]
  }
}

# 5. Clé API IAM spécifique pour que l'app Node.js accède au Bucket S3
resource "scaleway_iam_api_key" "s3_credentials" {
  application_id = scaleway_iam_application.api.id
  description    = "Clé d'accès S3 pour l'application docdoc"
  # L'organisation impose une date d'expiration pour les clés API
  expires_at = "2027-01-01T00:00:00Z"
}

# 6. Déploiement du conteneur Serverless depuis Docker Hub
resource "scaleway_container" "app" {
  namespace_id = scaleway_container_namespace.main.id
  name  = "docdoc-app"

  # Image hébergée sur Docker Hub
  image = "docker.io/emmanuel7044/docdoc:2.0"
  port  = 3000

  # Échelle fixée à 1 instance
  min_scale = 1
  max_scale = 1

  # Variables d'environnement publiques pour le SDK S3
  environment_variables = {
    NODE_ENV    = "production"
    S3_ENDPOINT = "https://s3.fr-par.scw.cloud"
    S3_REGION   = "fr-par"
    S3_BUCKET   = scaleway_object_bucket.json_data.name
  }

  # Variables d'environnement sécurisées (Clés d'accès S3)
  secret_environment_variables = {
    AWS_ACCESS_KEY_ID     = scaleway_iam_api_key.s3_credentials.access_key
    AWS_SECRET_ACCESS_KEY = scaleway_iam_api_key.s3_credentials.secret_key
  }
}

# 7. Outputs
output "app_url" {
  description = "URL d'accès HTTPS à l'application docdoc"
  value       = scaleway_container.app.public_endpoint
}

output "s3_bucket_name" {
  description = "Nom du bucket S3 créé"
  value       = scaleway_object_bucket.json_data.name
}
