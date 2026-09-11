---
name: dev-environment
description: "Démarrage complet de l'environnement de développement LiveAlert : Docker Compose (BDD, Keycloak), backend Spring Boot (tplu1), frontend Vite (tplu2), puis ouverture du navigateur. Utiliser quand l'utilisateur veut démarrer, lancer ou initialiser son environnement de dev."
---

# Skill : Démarrage de l'environnement de développement LiveAlert

Ce skill orchestre le lancement complet de l'environnement de développement local en 4 étapes séquentielles.

## Prérequis

- Docker disponible en ligne de commande (natif Windows, pas WSL)
- Maven configuré avec `settings.xml` dans `tplu1-api-livealert`
- Node.js / npm installé pour le frontend `tplu2-spa-livealert`

## Étapes à exécuter

**IMPORTANT** : Utiliser `run_in_terminal` (non-background) uniquement pour Docker Compose.
Pour le backend et le frontend, utiliser **`run_task`** (VS Code Tasks) qui créent des terminaux persistants indépendants de la conversation Copilot.
Les étapes 2 et 3 doivent être lancées après vérification que les services Docker sont opérationnels mais peuvent être lancées en parallèle une fois que Docker est prêt.

### Étape 1 — Docker Compose (services d'infrastructure)

Lancer Docker Compose via `run_in_terminal` (non-background, attendre la fin) dans le dossier `tplu1-api-livealert` :

```
cd c:\Users\pwzf831\chantiers\Chantiers-LiveAlert\tplu1-api-livealert
docker compose up -d
```

- Attend que les conteneurs soient démarrés (PostgreSQL, Keycloak, pgAdmin, Structurizr)
- Vérifier avec `docker compose ps` que tous les services sont `running` ou `healthy`
- **Ne pas passer à l'étape suivante tant que les conteneurs ne sont pas prêts**

### Étape 2 — Backend Spring Boot (tplu1-api-livealert)

Lancer le backend via **`run_task`** (VS Code Task persistante) :

```
run_task(
  workspaceFolder: "c:\\Users\\pwzf831\\chantiers\\Chantiers-LiveAlert\\tplu1-api-livealert",
  id: "shell: Spring Boot: Run"
)
```

- Le backend écoute sur le port **8080**
- La tâche VS Code persiste même si la conversation Copilot change
- Attendre quelques secondes avant de passer à l'étape suivante

### Étape 3 — Frontend Vite (tplu2-spa-livealert)

Lancer le frontend via **`run_task`** (VS Code Task persistante) :

```
run_task(
  workspaceFolder: "c:\\Users\\pwzf831\\chantiers\\Chantiers-LiveAlert\\tplu2-spa-livealert",
  id: "shell: Vite: Dev"
)
```

- Le frontend écoute sur le port **5173**
- Le proxy Vite redirige `/api` et `/sse` vers `http://localhost:8080`
- La tâche VS Code persiste même si la conversation Copilot change

### Étape 4 — Ouvrir le navigateur

Ouvrir le navigateur avec l'outil `open_browser_page` sur :

```
http://localhost:5173
```



### Étape 5 — Démarrer le serveur MCP Figma (optionnel, pour l'agent Vue.js)

Le serveur MCP Figma (pour l'intégration Figma → Vue.js) est désormais intégré au docker-compose :

- Ajoutez votre token personnel dans le fichier `.env` à la racine de `tplu1-api-livealert` :
  ```
  FIGMA_API_KEY=figd_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
  ```
- Lancez simplement `docker compose up` pour démarrer tous les services, y compris MCP Figma.
- Le serveur MCP Figma écoute sur le port **3333** (http://localhost:3333/mcp).

**Prérequis** : ne jamais versionner le fichier `.env` (il est ignoré par git). Chaque développeur doit renseigner son propre token localement.

Cette étape est nécessaire uniquement si vous souhaitez utiliser l'agent Vue.js pour générer des composants à partir de Figma.

## Ordre et dépendances

```
Docker Compose (BDD + Keycloak) → Backend Spring Boot → Frontend Vite → Navigateur
```

Chaque étape dépend de la précédente. Ne pas lancer le backend tant que Docker Compose n'est pas prêt. Ne pas ouvrir le navigateur avant que le frontend soit lancé.

## Ports utilisés

| Service         | Port  |
|-----------------|-------|
| PostgreSQL (app)| 5432  |
| pgAdmin         | 5050  |
| Keycloak        | 8088  |
| Backend API     | 8080  |
| Frontend SPA    | 5173  |
| Structurizr     | 8090  |

## Arrêt de l'environnement

Pour arrêter l'ensemble :
1. Arrêter les terminaux du frontend et du backend (Ctrl+C ou kill)
2. `docker compose stop` dans `tplu1-api-livealert`
