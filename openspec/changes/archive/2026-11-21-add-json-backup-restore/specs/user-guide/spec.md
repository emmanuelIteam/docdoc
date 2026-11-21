## ADDED Requirements

### Requirement: Documenter la sauvegarde et la restauration

Le système SHALL documenter dans la page « Aide » une section « Sauvegarder et restaurer ses données » expliquant que le fichier JSON exporté contient les thèmes, les domaines actifs et les archives, qu'il ne contient ni l'adresse email ni les passkeys, que la restauration remplace intégralement les données du compte, et que les commandes se trouvent dans la section « Sauvegarde » de la page Administration. La section SHALL contenir un lien vers `/administration`.

#### Scenario: Le guide documente l'export

- **WHEN** la page « Aide » est rendue
- **THEN** elle décrit le fichier JSON exporté et son contenu : les thèmes, les domaines actifs et les archives

#### Scenario: Le guide documente les exclusions

- **WHEN** la page « Aide » est rendue
- **THEN** elle indique que l'export ne contient ni l'adresse email ni les passkeys

#### Scenario: Le guide explique le remplacement

- **WHEN** la page « Aide » est rendue
- **THEN** elle indique que la restauration remplace l'intégralité des données actuelles du compte

#### Scenario: Le guide renvoie vers la page Administration

- **WHEN** la page « Aide » est rendue
- **THEN** elle indique que les commandes se trouvent dans la section « Sauvegarde » de la page Administration et contient un lien vers `/administration`
