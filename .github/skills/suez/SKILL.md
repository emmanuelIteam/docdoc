---
name: suez
description: Description du service KAFKA à La Poste (SUEZ).
---

# Suez Skill

SUEZ est actuellement en Kafka en version 3.9 ( ConfluentPlatform 7.9.5) sur l'ensemble des environnements.

## Description succincte
Suez est un bus de message Kafka. 
Suez est une plate-forme Kafka de streaming de données open-source, conçue pour stocker, traiter et distribuer des flux de données en temps réel.
Elle se base sur un modèle de publication-souscription, avec des sujets, des partitions et un cluster distribué.

Suez permet de stocker, de traiter et de distribuer des flux de données en temps réel entre différentes applications ou systèmes. 
​​​​​​​Suez est Multi-datacenter, Industrialisé et Mutualisé.

Suez c'est des échanges performants avec plusieurs dizaines de milliers de messages par seconde.  « Temps Réel Asynchrone » / Diffusion d’information.

## Cas d'utilisation
Suez peut être utilisé dans de nombreux cas d'utilisation, notamment :

Streaming de données en temps réel : Suez est conçu pour permettre le traitement et le stockage de grands volumes de données en temps réel. Il est utilisé pour collecter, traiter et diffuser des données en continu, pour des applications telles que l'analyse de données en temps réel, les alertes en temps réel, ou encore la surveillance en temps réel.
 
Intégration d'applications : Suez permet d'intégrer facilement des applications hétérogènes, en permettant la communication entre les différentes applications via un flux de données commun. Il peut être utilisé pour intégrer des applications dans des environnements de micro services, des architectures orientées événements, ou encore des systèmes de traitement de flux de données.
 
Analyse de données : Suez peut être utilisé pour alimenter des pipelines d'analyse de données, tels que des pipelines de Machine Learning ou d'analyse prédictive. Il permet de collecter des données de différents systèmes et de les transformer en données structurées, pour faciliter l'analyse et la prise de décision.
 
IoT (Internet des objets) : Suez peut être utilisé pour gérer les données en temps réel générées par les appareils connectés dans les applications IoT. Il permet de collecter, traiter et stocker les données générées par les capteurs et les appareils IoT, pour permettre leur analyse et leur exploitation.

Gestion des événements : Suez peut être utilisé pour gérer les événements dans les applications distribuées. Il permet de collecter les événements générés par les différentes applications et de les diffuser à tous les systèmes qui en ont besoin, pour permettre une coordination et une collaboration efficace entre les différents composants d'une application distribuée.
Suez est une plate-forme de streaming de données, qui peut être utilisée dans de nombreux cas d'utilisation différents. Ses fonctionnalités avancées et sa facilité d'utilisation en font un choix populaire pour les projets qui cherchent à gérer leurs flux de données de manière efficace.

## Prérequis

Topics privés :

Les topics privés n’ont pas pour vocation d'être partagés avec d'autres projets.

Mode batch massifs :

Les sollicitations violentes de ce mode provoquent de forts impacts sur le Kafka mutualisé.

Ce fonctionnement est à éviter, en cas d’abus pour les projets nous sommes capables de mettre en place des quotas.

Echanges de fichiers :

Le fonctionnement évènementiel est à privilégier.

Kafka et SUEZ ne sont pas fait pour ça.
Pour des fichiers volumineux, il vaut mieux trouver une autre solution.

Taille des messages :

La taille limite des messages est de 1 Mo, Les projets doivent se demander si leur architecture est bonne au-delà de 100 champs et 100 Ko dans un message.

## Recommandations d’utilisation
Format d’échange :

Utilisation du schéma registry et de la sérialisation AVRO. Le JSON est autorisé.​​​​​​​
Gestion des « gros » topics :

Les projets BSCC qui utilisent de très gros topics (plusieurs 100 Go ++) devront faire l’objet d’une étude : utilisation de SUEZ vs Kafka privé (ex : OREST TAE)
Mode batch massifs :

A éviter fortement, pour éviter les sollicitations trop violentes de kafka qui nous obligeraient à oversizer nos plateformes.
Nous sommes capables de brider un producer unilatéralement en cas de sur-sollicitation.
Echanges de fichiers :

Le fonctionnement évènementiel est à privilégier.
Kafka (et SUEZ) n’est pas fait pour ça. Pour des fichiers volumineux, il vaut mieux trouver une autre solution : CFT, PANAMA, partage NFS, …
Taille des messages :

La taille limite des messages est de 1 Mo, Les projets doivent se demander si leur architecture est bonne au-delà de 100 champs et 10 Ko dans un message.​​​​​​​
Gestion des offsets :

Ils sont propres à chaque cluster Kafka (donc à chaque DC)
Le commit des offsets ne doit être fait que lorsque les données ont été correctement intégrées (fonctionnement : AT LEAST ONE)

## Fonctionnement Avro avec le Schema Registry
L'Avro est un format de sérialisation de données populaire pour la communication entre les systèmes distribués. Il permet de représenter des données structurées dans un format compact et binaire, ce qui facilite leur stockage, leur transmission et leur traitement.

Kafka utilise des topics pour organiser les flux de données, et les messages sont stockés de manière persistante sur le disque.
Le Schema Registry de Confluent est un service qui permet de stocker et de gérer des schémas Avro pour Kafka.
Il permet aux producteurs et aux consommateurs de valider les données échangées en temps réel et de garantir leur conformité avec la structure des données prévue.

Le fonctionnement d'Avro avec le schema registry de Confluent et Kafka est le suivant :

Un producteur de données crée un schéma Avro pour les données qu'il souhaite publier sur Kafka.

Le producteur enregistre le schéma auprès du schema registry de Confluent.
Le schema registry attribue une ID unique au schéma et le stocke dans son registre.

Le producteur publie des messages sur Kafka en utilisant le schéma enregistré.
Le message contient l'ID du schéma et les données sérialisées dans le format Avro.

Les consommateurs récupèrent les messages à partir de Kafka et utilisent le schéma enregistré pour désérialiser les données. Ils peuvent ainsi valider la structure des données et garantir leur conformité avec le schéma prévu.

L'utilisation d'Avro avec le Schema Registry avec Kafka permet de garantir la cohérence et la qualité des données échangées entre les systèmes distribués. Le Schema Registry permet de stocker et de gérer les schémas de manière centralisée, ce qui facilite la gestion et la maintenance des données à grande échelle.

Avantages d'Avro par rapport à JSON :

Compact et efficace : Avro utilise un format binaire compact et optimisé pour la sérialisation et la désérialisation des données, ce qui permet une utilisation plus efficace de la bande passante et de l'espace de stockage par rapport à JSON.
Types de données explicites : Avro utilise des schémas pour définir les types de données, ce qui permet une validation plus stricte des données et une meilleure documentation de leur structure par rapport à JSON, qui ne définit pas de schéma.
Évolution des schémas : Avro permet de gérer facilement l'évolution des schémas de données, en permettant l'ajout, la suppression ou la modification de champs sans interrompre la compatibilité avec les versions précédentes du schéma.
Intégration avec Kafka : Avro est un format de sérialisation de données pris en charge nativement par Kafka, et le schema registry de Confluent permet de gérer les schémas de manière centralisée et de garantir leur compatibilité.
Inconvénients d'Avro par rapport à JSON :

Complexité : Avro est plus complexe à utiliser que JSON en raison de l'utilisation de schémas, ce qui peut nécessiter une formation ou une expertise supplémentaire.
Performance de la désérialisation : La désérialisation des données Avro peut être plus coûteuse en termes de temps de traitement que la désérialisation de JSON, bien que cela dépende des cas d'utilisation et de la complexité des données.
Le choix entre Avro et JSON dépend des besoins spécifiques du projet et des exigences en matière de performance, de validation et de gestion des schémas de données. Avro peut offrir des avantages en termes de performance, de types de données explicites et d'évolution des schémas, mais peut être plus complexe à utiliser.

## Environnements Suez

### Liste des ports
- Kafka	9092
  - Kafka TLS	9093
  - Schema-Registry	443

### DNS
#### Environnement d'accostage
##### Cluster KAFKA
kafka1-acc.suez-lcl.build.net.intra.laposte.fr
kafka2-acc.suez-lcl.build.net.intra.laposte.fr
kafka3-acc.suez-lcl.build.net.intra.laposte.fr
kafka4-acc.suez-lcl.build.net.intra.laposte.fr
kafka5-acc.suez-lcl.build.net.intra.laposte.fr
kafka6-acc.suez-lcl.build.net.intra.laposte.fr

##### ZOOKEEPER
zookeeper1-acc.suez-lcl.build.net.intra.laposte.fr
zookeeper2-acc.suez-lcl.build.net.intra.laposte.fr
zookeeper3-acc.suez-lcl.build.net.intra.laposte.fr

##### SCHEMA REGISTRY
schema-acc.suez-lcl.build.net.intra.laposte.fr

##### ADMIN IHM
admin-ihm-acc.suez-lcl.build.net.intra.laposte.fr

#### Environnement de production
##### Cluster KAFKA
kafka1.suez.net.intra.laposte.fr
kafka2.suez.net.intra.laposte.fr
kafka3.suez.net.intra.laposte.fr
kafka4.suez.net.intra.laposte.fr
kafka5.suez.net.intra.laposte.fr
kafka6.suez.net.intra.laposte.fr
kafka7.suez.net.intra.laposte.fr
kafka8.suez.net.intra.laposte.fr
kafka9.suez.net.intra.laposte.fr
kafka10.suez.net.intra.laposte.fr
kafka11.suez.net.intra.laposte.fr
kafka12.suez.net.intra.laposte.fr
kafka13.suez.net.intra.laposte.fr
kafka14.suez.net.intra.laposte.fr
kafka15.suez.net.intra.laposte.fr
kafka16.suez.net.intra.laposte.fr
kafka17.suez.net.intra.laposte.fr
kafka18.suez.net.intra.laposte.fr
kafka19.suez.net.intra.laposte.fr
kafka20.suez.net.intra.laposte.fr
kafka21.suez.net.intra.laposte.fr
kafka22.suez.net.intra.laposte.fr
kafka23.suez.net.intra.laposte.fr
kafka24.suez.net.intra.laposte.fr

##### ZOOKEEPER
zookeeper1.suez.net.intra.laposte.fr
zookeeper2.suez.net.intra.laposte.fr
zookeeper3.suez.net.intra.laposte.fr

##### SCHEMA REGISTRY
schema.suez.net.intra.laposte.fr

##### ADMIN IHM
admin-ihm.suez.net.intra.laposte.fr
