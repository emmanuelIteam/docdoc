## REMOVED Requirements

### Requirement: Redirect the homepage to the default domain
**Reason**: La racine `/` sert désormais la page d'accueil qui agrège les tâches en cours de tous les domaines (voir la capacité `home-dashboard`). Une redirection vers le domaine par défaut empêcherait d'afficher cette vue d'ensemble.
**Migration**: Aucune donnée à migrer. Un favori ou un lien vers `/` affiche la page d'accueil ; le domaine par défaut reste atteignable depuis le panneau latéral ou par son URL directe `/domaine/<slug>`.
