---
name: git-reset-soft
description: "utiliser lorsque le developpeur souhaite reformatter le jounal des commits pour une branche, en utilisant git reset --soft pour conserver les changements dans l'index et le working directory, afin de réorganiser, fusionner ou modifier les commits avant de les pousser."
---

# Skill : Reformatage du journal des commits avec git reset --soft

## But
- Permettre à l'utilisateur de réorganiser son journal de commits de manière flexible, en conservant les changements dans l'index et le working directory pour faciliter la création de nouveaux commits plus propres et mieux structurés avant de les pousser vers le dépôt distant.

## Etape 1 — capter les données d'entrée

- Demander à l'utilisateur la branche cible à reformater (ex: `feature/xyz`) proposer par défaut la branche courante.
- Demander à l'utilisateur le commit ou le tag de référence pour le reset (ex: `HEAD~3` ou `abc1234`)

## Etape 2 — exécuter la commande git reset --soft
- Exécuter la commande suivante dans le terminal du projet Git :

```
git reset --soft <commit-or-tag>
```

- Cette commande va réinitialiser la branche courante à l'état du commit ou tag spécifié, tout en conservant les changements dans l'index et le working directory.

## Etape 3 — réorganiser, fusionner les modifications
- Après le reset, les changements sont prêts à être réorganisés, fusionnés ou modifiés avant de les committer à nouveau.

- Regrouper les modifications par fonctionnalité ou thème, puis créer de nouveaux commits avec des messages clairs et descriptifs.

- Eventuellement s'inspirer des commits précédents pour rédiger les nouveaux messages de commit, en améliorant la clarté et la cohérence.
