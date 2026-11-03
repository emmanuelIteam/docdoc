## ADDED Requirements

### Requirement: Exposer le tag de release à l'application

Le système SHALL embarquer dans l'image finale le tag de la release comme variable d'environnement `APP_VERSION`, afin que l'application en cours d'exécution connaisse la version qu'elle sert. La valeur SHALL être celle de l'argument de build `APP_VERSION` transmis par la pipeline de release — le même que celui inscrit dans `CACHE_VERSION` du service worker, de sorte que les deux désignent toujours la même version. Un build sans argument SHALL produire une image dont `APP_VERSION` est vide, que l'application traite comme un build de développement. Le runtime SHALL lire la valeur dans l'environnement de l'image : le démarrage du conteneur ne SHALL demander aucune variable supplémentaire pour l'exposer.

#### Scenario: L'image de release expose son tag
- **WHEN** l'image est construite avec `--build-arg APP_VERSION=2.0.1`
- **THEN** un conteneur démarré depuis cette image sert une page « Aide » qui annonce « Version 2.0.1 »

#### Scenario: Le tag et la version de cache restent alignés
- **WHEN** une image de release est construite avec un tag
- **THEN** `sw.js` déclare `CACHE_VERSION = '<tag>'` et l'application rapporte le même tag sur la page « Aide »

#### Scenario: Un build local ne prétend pas être une release
- **WHEN** l'image est construite sans argument `APP_VERSION`
- **THEN** `APP_VERSION` est vide dans le conteneur et la page « Aide » affiche « Version développement »

#### Scenario: Aucune configuration du conteneur n'est nécessaire
- **WHEN** le conteneur est démarré sur Scaleway sans variable `APP_VERSION` définie dans sa configuration
- **THEN** la valeur employée pour la page « Aide » est celle que porte l'image
