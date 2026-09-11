---
name: keycloak-refresh-config
description: Forcer Keycloak à réimporter le fichier realm-export.json (utilisateurs, rôles, clients...) lors du développement.
---
# SKILL: Raffraîchir la configuration Keycloak (import realm-export.json)

## Objectif
Forcer Keycloak à réimporter le fichier `realm-export.json` (utilisateurs, rôles, clients...) lors du développement.

## Procédure complète

1. **Arrêter tous les containers**
   ```sh
   docker compose down
   ```
2. **Supprimer le volume Docker de données Keycloak**
   > ⚠️ Cette opération supprime toutes les données Keycloak (realms, utilisateurs, clients, etc.)
   ```sh
   docker volume rm tplu1-api-livealert_keycloak_data
   ```
3. **Relancer la stack**
   ```sh
   docker compose up -d
   ```
4. **Vérifier**
   - L'utilisateur ou la modification attendue doit être présente dans Keycloak.
   - Si besoin, consulter les logs du container Keycloak pour vérifier l'import.

## Pourquoi ?
- Keycloak n'importe le fichier `realm-export.json` **que si le realm n'existe pas déjà** dans la base de données.
- Le volume Docker `keycloak_data` contient la base persistante. Tant qu'il existe, l'import n'est pas rejoué.
- Un simple `restart` ou `up -d` ne suffit pas.

## Astuce
- Pour des tests fréquents, vous pouvez automatiser cette séquence dans un script.

---
**Skill maintenu par l'équipe LiveAlert**
