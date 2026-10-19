# Valeurs d'exécution du déploiement docdoc.re.
# Aucun secret ici : ils vivent dans secrets.sops.yaml, injectés par
# `sops exec-env secrets.sops.yaml 'tofu ...'`.

# Domaine personnalisé, rattaché au conteneur : sans cette valeur, un apply
# détruirait l'enregistrement DNS (ALIAS) et l'endpoint personnalisé.
domain_name   = "docdoc.re"
attach_domain = true

# RP ID et origine déduits du domaine personnalisé (local.rp_id = docdoc.re),
# pour que les passkeys soient liées au nom servi. Laisser vide.
rp_id     = ""
rp_origin = ""
