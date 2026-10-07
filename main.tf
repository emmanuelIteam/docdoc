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

# ---------------------------------------------------------------------------
# Paramètres ajustables
# ---------------------------------------------------------------------------

variable "app_image" {
  description = "Image Docker de l'application. Le dépôt Docker Hub emmanuel7044/docdoc ne publie que les tags 1.0 et 1.1 : le tag 2.0, référencé par une version antérieure de ce fichier, n'existe pas."
  type        = string
  default     = "docker.io/emmanuel7044/docdoc:1.1"
}

variable "keep_warm" {
  description = "true : une instance reste allumée en permanence (réponse instantanée, toujours 0 € au palier 128 Mo). false : mise à l'échelle à zéro quand l'application n'est pas utilisée (quelques secondes de démarrage à la première requête)."
  type        = bool
  default     = true
}

# ---------------------------------------------------------------------------
# Accès par passkeys (WebAuthn)
#
# Le RP ID est le nom d'hôte servi au navigateur : une passkey y est liée pour
# toute sa vie. Tant que le conteneur n'expose que son endpoint généré
# (docdocnamespace…scw.cloud), recréer le namespace change ce nom et invalide
# donc toutes les passkeys enregistrées. Rattacher un domaine personnalisé au
# conteneur, puis mettre à jour rp_id et rp_origin, est la seule façon de figer
# cette valeur. En attendant, la récupération par code email reste possible.
# ---------------------------------------------------------------------------

variable "rp_id" {
  description = "RP ID WebAuthn : nom d'hôte servi, sans schéma ni port. Vide (défaut) : le nom d'hôte du domaine personnalisé s'il est configuré, sinon l'endpoint généré du conteneur. À ne renseigner que pour forcer une valeur (par exemple le domaine parent quand l'application est servie sur un sous-domaine)."
  type        = string
  default     = ""
}

variable "rp_origin" {
  description = "Origine HTTPS complète de l'application (schéma + hôte, sans barre finale). Vide (défaut) : déduite du RP ID effectif."
  type        = string
  default     = ""
}

variable "authorized_emails" {
  description = "Adresses autorisées à posséder un espace docdoc, séparées par des virgules."
  type        = string
  default     = "emmanuel.grandiere@laposte.net"
}

variable "email_provider" {
  description = "Fournisseur d'envoi des codes : scaleway ou brevo. Ne jamais laisser dev en production (les codes seraient écrits dans les journaux)."
  type        = string
  default     = "scaleway"
}

variable "email_from" {
  description = "Expéditeur des codes. Le domaine doit être authentifié (SPF/DKIM) chez le fournisseur : une adresse @laposte.net serait rejetée."
  type        = string
  default     = ""
}

variable "session_secret" {
  description = "Secret de signature du cookie de session (openssl rand -hex 32). À fournir via TF_VAR_session_secret."
  type        = string
  sensitive   = true
}

variable "tem_secret_key" {
  description = "Clé secrète IAM autorisée à envoyer via Scaleway Transactional Email. Laisser vide tant que l'email n'est pas configuré : l'application démarre et signale l'échec d'envoi."
  type        = string
  sensitive   = true
  default     = ""
}

variable "tem_project_id" {
  description = "Identifiant du projet Scaleway rattaché aux envois Transactional Email."
  type        = string
  default     = ""
}

# ---------------------------------------------------------------------------
# Domaine personnalisé (facultatif)
#
# Rattacher un domaine est la seule façon de figer le RP ID des passkeys, et le
# préalable à un domaine d'envoi authentifié (SPF/DKIM) pour les codes email.
# Le domaine lui-même se facture au prix du nom chez Scaleway Domains & DNS
# (~7,91 € TTC/an pour un .re) ; l'endpoint personnalisé et son certificat
# Let's Encrypt, généré et renouvelé automatiquement, sont gratuits.
# ---------------------------------------------------------------------------

variable "domain_name" {
  description = "Domaine personnalisé rattaché au conteneur (ex. \"docdoc.re\"), sans sous-domaine. Vide : l'application reste servie par l'endpoint généré (... .functions.fnc.fr-par.scw.cloud). Le domaine doit déjà exister dans Scaleway Domains & DNS, qui héberge sa zone : les enregistrements DNS de cette configuration sont créés dedans."
  type        = string
  default     = ""
}

variable "domain_record_name" {
  description = "Nom de l'enregistrement DNS dans la zone : \"\" sert le domaine à la racine, \"app\" ou \"www\" sert un sous-domaine (l'hôte final devient alors app.docdoc.re)."
  type        = string
  default     = ""
}

variable "domain_record_type" {
  description = "Type de l'enregistrement DNS. \"ALIAS\" à la racine, où un CNAME est interdit et où Scaleway DNS gère les ALIAS ; \"CNAME\" dès que domain_record_name n'est pas vide."
  type        = string
  default     = "ALIAS"
}

variable "attach_domain" {
  description = "true (défaut) : le domaine personnalisé est déclaré sur le conteneur, ce qui déclenche l'émission du certificat TLS. false : seul l'enregistrement DNS est créé — première étape de l'apply en deux temps, le temps que la résolution soit visible (sinon le challenge HTTP-01 de Let's Encrypt échoue et l'endpoint reste en « error »)."
  type        = bool
  default     = true
}

locals {
  # Endpoint généré du conteneur : valeur de repli du RP ID tant qu'aucun
  # domaine personnalisé n'est rattaché. Recréer le namespace changerait ce nom
  # et invaliderait d'un coup toutes les passkeys (cf. Readme).
  default_host = "docdocnamespace572c01fb-docdoc-app.functions.fnc.fr-par.scw.cloud"

  # Hôte servi par le domaine personnalisé : "docdoc.re" à la racine,
  # "app.docdoc.re" si domain_record_name = "app". Vide sans domaine.
  custom_host = (
    var.domain_name == ""
    ? ""
    : (var.domain_record_name == "" ? var.domain_name : "${var.domain_record_name}.${var.domain_name}")
  )

  # Priorité : valeur explicite > domaine personnalisé > endpoint généré.
  # Le calcul reste local : déduire le repli de
  # scaleway_container.app.public_endpoint créerait un cycle, cet attribut étant
  # calculé par le conteneur que ces valeurs alimentent.
  rp_id     = var.rp_id != "" ? var.rp_id : (local.custom_host != "" ? local.custom_host : local.default_host)
  rp_origin = var.rp_origin != "" ? var.rp_origin : "https://${local.rp_id}"
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

# ---------------------------------------------------------------------------
# 6. Déploiement du conteneur Serverless depuis Docker Hub (offre gratuite)
#
#    Free tier Serverless Containers, par compte et par mois :
#      400 000 GB/s et 200 000 vCPU/s.
#
#    Au palier 128 Mo / 0,07 vCPU, une instance allumée 30 jours consomme :
#      mémoire : 0,125 GB x 2 592 000 s = 324 000 GB/s   (< 400 000)
#      vCPU    : 0,07     x 2 592 000 s = 181 440 vCPU/s (< 200 000)
#    soit 0 € — y compris sans mise à l'échelle à zéro.
#
#    Au palier 256 Mo / 0,14 vCPU, les deux plafonds sont dépassés
#    (environ 1,90 €/mois). Ne pas augmenter memory_limit / cpu_limit sans
#    vérifier la consommation du mois dans la console Scaleway.
# ---------------------------------------------------------------------------
resource "scaleway_container" "app" {
  namespace_id = scaleway_container_namespace.main.id
  name         = "docdoc-app"

  # Image hébergée sur Docker Hub
  image = var.app_image
  port  = 3000

  # Une seule instance : l'application garde son état en mémoire, elle n'est pas
  # conçue pour plusieurs réplicas simultanés.
  min_scale = var.keep_warm ? 1 : 0
  max_scale = 1

  # Palier le plus bas : seul moyen de tenir dans le free tier en permanence.
  memory_limit = 128 # Mo
  cpu_limit    = 70  # mVCPU (valeur par défaut du provider Scaleway)

  # Variables d'environnement publiques pour le SDK S3
  environment_variables = {
    NODE_ENV    = "production"
    S3_ENDPOINT = "https://s3.fr-par.scw.cloud"
    S3_REGION   = "fr-par"
    S3_BUCKET   = scaleway_object_bucket.json_data.name
    # Accès par passkeys (déduits du domaine personnalisé s'il est configuré)
    RP_ID             = local.rp_id
    RP_ORIGIN         = local.rp_origin
    AUTHORIZED_EMAILS = var.authorized_emails
    # Envoi des codes par email
    EMAIL_PROVIDER  = var.email_provider
    EMAIL_FROM      = var.email_from
    EMAIL_FROM_NAME = "docdoc"
    EMAIL_REGION    = "fr-par"
  }

  # Variables d'environnement sécurisées (Clés d'accès S3)
  secret_environment_variables = {
    AWS_ACCESS_KEY_ID     = scaleway_iam_api_key.s3_credentials.access_key
    AWS_SECRET_ACCESS_KEY = scaleway_iam_api_key.s3_credentials.secret_key
    # Signature du cookie de session
    SESSION_SECRET = var.session_secret
    # Envoi des codes via Scaleway Transactional Email (X-Auth-Token)
    SCW_SECRET_KEY         = var.tem_secret_key
    SCW_DEFAULT_PROJECT_ID = var.tem_project_id
  }
}

# ---------------------------------------------------------------------------
# 7. Rattachement du domaine personnalisé (facultatif)
#
#    Sans -var domain_name=..., rien de tout ceci n'est créé et l'application
#    reste sur son endpoint généré.
#
#    Scaleway impose un ordre : l'enregistrement DNS doit d'abord résoudre vers
#    l'endpoint du conteneur, et seulement ensuite le domaine est déclaré sur le
#    conteneur. Dans l'autre sens, le challenge HTTP-01 de Let's Encrypt échoue
#    après 3 minutes et l'endpoint personnalisé reste en statut « error ».
#    D'où un apply en deux temps, attach_domain servant de sas :
#
#      # 1. l'enregistrement DNS seul
#      tofu apply -var domain_name=docdoc.re -var attach_domain=false
#      # 2. vérifier la résolution (la réponse doit citer l'endpoint du conteneur)
#      dig docdoc.re @1.1.1.1
#      dig docdoc.re @8.8.8.8
#      # 3. l'endpoint personnalisé sur le conteneur (certificat TLS émis ici)
#      tofu apply -var domain_name=docdoc.re
#
#    attach_domain vaut true par défaut : un apply ultérieur sans cette variable
#    ne retire donc jamais l'endpoint personnalisé par inadvertance.
#
#    Le domaine personnalisé s'ajoute à l'endpoint généré, il ne le remplace
#    pas : les deux restent joignables.
# ---------------------------------------------------------------------------
resource "scaleway_domain_record" "app" {
  count = var.domain_name != "" ? 1 : 0

  dns_zone = var.domain_name
  name     = var.domain_record_name
  type     = var.domain_record_type

  # Cible : l'endpoint généré du conteneur, sans le schéma.
  data = replace(scaleway_container.app.public_endpoint, "https://", "")
  ttl  = 300
}

resource "scaleway_container_domain" "app" {
  count = var.domain_name != "" && var.attach_domain ? 1 : 0

  container_id = scaleway_container.app.id
  hostname     = local.custom_host

  # L'endpoint ne peut être validé qu'une fois l'enregistrement DNS visible.
  depends_on = [scaleway_domain_record.app]
}

# 8. Outputs
output "app_url" {
  description = "URL d'accès HTTPS à l'application docdoc"
  value       = var.domain_name != "" ? "https://${local.custom_host}" : scaleway_container.app.public_endpoint
}

output "rp_id" {
  description = "RP ID WebAuthn effectivement injecté dans le conteneur (nom d'hôte servi)"
  value       = local.rp_id
}

output "s3_bucket_name" {
  description = "Nom du bucket S3 créé"
  value       = scaleway_object_bucket.json_data.name
}
