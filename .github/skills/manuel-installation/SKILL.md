---
name: manuel-installation
description: "Créer ou modifier un document de manuel d'installation pour un module de l'application en suivant le format attendu par l'exploitant."
---

# Skill : Création ou modification d'un manuel d'installation

## But

- Fournir un manuel d'installation du module applicatif au format MS WORD tel qu'attendu par l'exploitant de l'application, sur la base d'un modèle existant (ex: `assets/Manuel dInstallation Unix.docx`).

## Définitions

Suivant le standard et la norme de l'Informatique à La poste (SNILP), voici les définitions des variables attendues dans le manuel d'installation sur la première page et l'entête, telles que :

- APPLICATION : Nom de l'application pour laquelle le manuel d'installation est créé ou modifié
- ccx : code SNI de l'application
- tm :
  -- t : type de module de l'application
  -- m : numéro de module de l'application
- MODULE : identique à tm
- CCXTM : identique à tm mais plus complet puisqu'il reprécise le code SNI de l'application, par exemple TPLU1 pour le module U1 de l'application Live Alert
- xx_yy_yy ou XX_YY_ZZ : Version du module tm
- a.b : Numéro de version "comerciale" de l'application, prendre le xx de la variable xx_yy_yy ou XX_YY_ZZ pour renseigner "a" et le yy pour renseigner "b" en supprimant éventuellement les zéros non significatifs (ex: 01 devient 1)
- C<NNNNN> : Code du changement. Un changement est nécessaire pour marquer (tracer, mémoriser) l'installation d'une nouvelle version du module tm dans l'environnement de production (d'exploitation). 

## Etape 1 — Renseigner le chapitre EVOLUTION DU MANUEL

A ce chapitre renseigner le cartouche (tableau MS WORD) avec les informations suivantes :

- Date de création : prendre la date du jour
- Auteur : prendre le nom de l'utilisateur (si inconnu, le demander dans le prompt)
- objet : faire un bref résumé de la raison de la création ou de la modification du manuel d'installation, par exemple "Création du manuel d'installation pour le module U1 de l'application Live Alert"

## Etape 2 — capter la procédure à reformatter

- Demander à l'utilisateur de fournir la procédure d'installation à reformater, soit en copiant-collant le texte dans une zone de saisie.
- si des mots de passe ou des informations sensibles sont présents dans la procédure d'installation, préciser dans le manuel d'installation de les demander à la "MOE".

## Etape 3 — Lire le document exemple à la recherche des variables attendues

Lire le fichier `assets/Manuel dInstallation Unix.docx` pour identifier les variables attendues dans le manuel d'installation sur la première page et l'entête, telles que :
<APPLICATION>
[ccx]

Demander à l'utilisateur de fournir les valeurs correspondantes pour ces variables si tu n'as pas encore ces informations, par exemple : [ccx] = "tpl"

Pour ce projet, les variables attendues sont :
ccx : tpl
m : 1
APPLICATION : Live Alert
MODULE : U1
CCXTM : TPLU1
xx_yy_yy ou XX_YY_ZZ : prendre le nom de la branche courante
a.b : prendre le xx de la variable xx_yy_yy ou XX_YY_ZZ pour renseigner "a" et le yy pour renseigner "b" en supprimant éventuellement les zéros non significatifs (ex: 01 devient 1)

- Renseigner la variable <NNNNN> et <NN>. Demander à l'utilisateur de fournir

## Etape 4 — Reformatter la procédure d'installation

- Ignorer le chapitre 4
- Renseigner le chapitre 5 et les sous-chapitres avec la procédure d'installation fournie par l'utilisateur, en veillant à respecter la structure et le format du document exemple.

## Etape 5 — Générer le manuel d'installation

- Générer un document MS WORD à partir du document exemple en remplaçant les variables par les valeurs fournies par l'utilisateur et en intégrant la procédure d'installation reformattée.
- Enregistrer le document généré dans le répertoire ./integration/DMP/MIN avec un nom de fichier au format "MEP_INS_[ccx]_[m]_ITAAS-SAFS_IAAS".docx", par exemple "MEP_INS_TPL_1_ITAAS-SAFS_IAAS.docx".
