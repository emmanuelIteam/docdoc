---
name: publier-maci-simulation
description: 'Encadrer la publication d’une MACI avec l’outil MCP publier_maci. Utiliser lorsqu’un utilisateur demande de créer, publier ou simuler une MACI : l’intitulé doit toujours se terminer par "(simulation)".'
user-invocable: false
---

# Publication d’une MACI de simulation

## Quand utiliser ce skill

Utiliser ce skill dès qu’une MACI doit être créée ou publiée avec l’outil MCP `publier_maci`.

## Règle obligatoire sur l’intitulé

Avant d’appeler l’outil :

1. Reprendre l’intitulé fourni par l’utilisateur.
2. Supprimer les espaces finaux superflus.
3. Ajouter ` (simulation)` si l’intitulé ne se termine pas déjà exactement par `(simulation)`.
4. Ne jamais ajouter le suffixe une deuxième fois.
5. Transmettre l’intitulé normalisé dans le champ `intitule` de l’outil.

Exemples :

- `Incident réseau` devient `Incident réseau (simulation)`.
- `Incident réseau (simulation)` reste `Incident réseau (simulation)`.
- `Incident réseau (Simulation)` devient `Incident réseau (Simulation) (simulation)` car le suffixe exact est sensible à la casse.

## Procédure

1. Identifier les champs obligatoires demandés par l’outil : `intitule`, `niveau` et `statut`.
2. Utiliser les exemples ci-dessous comme source d’inspiration, sans les recopier systématiquement.
3. Si l’utilisateur ne fournit pas de valeur obligatoire, choisir une valeur de test explicite et cohérente, ou demander une précision si le choix modifierait le sens métier.
4. Lorsque cela est pertinent, mixer plusieurs exemples ou imaginer un nouveau scénario réaliste en variant l’application, le domaine, le niveau, le statut, l’impact et le mode de résolution.
5. Veiller à ce que les valeurs inventées restent cohérentes entre elles et respectent les enums et les champs acceptés par l’outil.
6. Normaliser `intitule` selon la règle ci-dessus.
7. Appeler `mcp_maci-simulato_publier_maci` avec l’intitulé normalisé et les autres champs fournis ou déduits.
8. Confirmer à l’utilisateur le succès de la publication et rappeler l’`alertId` ainsi que l’intitulé effectivement publié.

Ne pas modifier les autres champs de la MACI pour appliquer cette règle.

## Exemples de données épurées

Les exemples ci-dessous sont synthétiques. Ils reprennent la structure des données
rencontrées dans les incidents source, sans conserver d’identifiant réel, de nom de
personne, de date précise, de balise HTML ou de détail technique sensible.

### Exemples issus de `exemple.txt`

Chaque bloc est un payload JSON autonome utilisable avec l’outil `publier_maci`.

Ces exemples ne sont pas un catalogue fermé. Pour chaque nouvelle demande, les mixer
si cela produit un scénario plus pertinent ou imaginer des données différentes. Ne pas
réutiliser les mêmes intitulés, identifiants, applications ou descriptions par défaut.
Les données inventées doivent rester synthétiques, non sensibles et compatibles avec
les valeurs autorisées par l’outil.

#### Application indisponible

```json
{
	"alertId": 1001,
	"intitule": "Dysfonctionnement d'une application metier (simulation)",
	"niveau": "ROUGE",
	"statut": "TERMINE",
	"domaine": "APPLICATION",
	"perimetreImpacte": "Utilisateurs d'une agence",
	"serviceTechnique": "Application metier",
	"contexte": "Une indisponibilite majeure a ete signalee sur une application metier.",
	"impact": "L'edition de documents etait indisponible pour les utilisateurs.",
	"consignes": "Le service a ete retabli apres intervention de l'equipe technique.",
	"origine": "Supervision",
	"ccx": "CCX_EXEMPLE",
	"priorite": "P1"
}
```

#### Portail dégradé

```json
{
	"alertId": 1002,
	"intitule": "Degradation d'un portail utilisateur (simulation)",
	"niveau": "ORANGE",
	"statut": "TERMINE",
	"domaine": "APPLICATION",
	"perimetreImpacte": "Utilisateurs internes",
	"serviceTechnique": "Portail utilisateur",
	"contexte": "Une degradation du service a ete signalee par le support.",
	"impact": "La connexion au portail etait ralentie en periode de forte frequentation.",
	"consignes": "Le nettoyage du cache applicatif a permis de retablir le service.",
	"origine": "Support",
	"ccx": "CCX_EXEMPLE",
	"priorite": "P1"
}
```

#### Service redémarré automatiquement

```json
{
	"alertId": 1003,
	"intitule": "Redemarrage automatique d'un service (simulation)",
	"niveau": "ORANGE",
	"statut": "TERMINE",
	"domaine": "INFORMATIQUE",
	"perimetreImpacte": "Environnement de production",
	"serviceTechnique": "Service d'indexation",
	"contexte": "Un dysfonctionnement du service d'indexation a ete detecte.",
	"impact": "Le service a ete indisponible pendant une courte periode.",
	"consignes": "Le redemarrage automatique a permis de retablir le service.",
	"origine": "Supervision",
	"ccx": "CCX_EXEMPLE",
	"priorite": "P1"
}
```

#### Service de gestion de stock

```json
{
	"alertId": 1004,
	"intitule": "Indisponibilite d'un service de gestion de stock (simulation)",
	"niveau": "ORANGE",
	"statut": "TERMINE",
	"domaine": "APPLICATION",
	"perimetreImpacte": "Site logistique",
	"serviceTechnique": "Gestion de stock",
	"contexte": "Une indisponibilite du service de gestion de stock a ete signalee.",
	"impact": "Les utilisateurs ne pouvaient plus acceder au service.",
	"consignes": "Le redemarrage du service a permis de retablir l'acces.",
	"origine": "Supervision",
	"ccx": "CCX_EXEMPLE",
	"priorite": "P1"
}
```

#### Application rétablie automatiquement

```json
{
	"alertId": 1005,
	"intitule": "Retablissement automatique d'une application (simulation)",
	"niveau": "ORANGE",
	"statut": "TERMINE",
	"domaine": "APPLICATION",
	"perimetreImpacte": "Utilisateurs internes",
	"serviceTechnique": "Application de gestion",
	"contexte": "Une indisponibilite temporaire de l'application a ete constatee.",
	"impact": "Le service etait indisponible pour les utilisateurs.",
	"consignes": "Le service s'est retabli automatiquement, sans intervention.",
	"origine": "Supervision",
	"ccx": "CCX_EXEMPLE",
	"priorite": "P1"
}
```

#### Déploiements bloqués sans impact utilisateur

```json
{
	"alertId": 1006,
	"intitule": "Blocage de deploiements applicatifs (simulation)",
	"niveau": "JAUNE",
	"statut": "TERMINE",
	"domaine": "INFORMATIQUE",
	"perimetreImpacte": "Equipe de deploiement",
	"serviceTechnique": "Chaine de deploiement",
	"contexte": "Un blocage des deploiements applicatifs a ete detecte.",
	"impact": "Les utilisateurs n'ont pas ete impactes.",
	"consignes": "Une action sur la chaine de deploiement a permis de resoudre l'incident.",
	"origine": "Equipe outillage",
	"ccx": "CCX_EXEMPLE",
	"priorite": "P2"
}
```

#### Indisponibilité courte d’un portail

```json
{
	"alertId": 1007,
	"intitule": "Indisponibilite courte d'un portail (simulation)",
	"niveau": "JAUNE",
	"statut": "TERMINE",
	"domaine": "INFORMATIQUE",
	"perimetreImpacte": "Utilisateurs du portail",
	"serviceTechnique": "Portail de production",
	"contexte": "Une indisponibilite courte du portail a ete detectee.",
	"impact": "L'acces au portail etait indisponible pendant quelques minutes.",
	"consignes": "La bascule automatique de l'infrastructure a retabli l'acces.",
	"origine": "Hebergeur",
	"ccx": "CCX_EXEMPLE",
	"priorite": "P1"
}
```

#### Incident en cours

```json
{
	"alertId": 1008,
	"intitule": "Incident applicatif en cours (simulation)",
	"niveau": "ROUGE",
	"statut": "ENCOURS",
	"domaine": "APPLICATION",
	"perimetreImpacte": "Utilisateurs internes",
	"serviceTechnique": "Application metier",
	"contexte": "Une indisponibilite applicative est en cours d'analyse.",
	"impact": "L'acces au service est perturbe.",
	"consignes": "Les equipes techniques poursuivent le diagnostic.",
	"origine": "Supervision",
	"ccx": "CCX_EXEMPLE",
	"priorite": "P1"
}
```

### Regles d’epuration

- Remplacer les identifiants d’incident et les identifiants source par des valeurs generiques.
- Supprimer les noms et mentions de personnes, y compris les champs `creePar` et `modifiePar`.
- Remplacer les dates et heures precises par des formulations relatives, sauf si elles sont necessaires au test.
- Retirer les balises HTML, styles, entites HTML et pieces jointes des textes d’exemple.
- Generaliser les noms d’applications, de services, d’equipes, de sites et de clients.
- Ne conserver que les champs acceptes par l’outil `publier_maci`.
