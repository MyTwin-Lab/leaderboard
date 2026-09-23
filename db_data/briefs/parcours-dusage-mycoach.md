## Context

> **Gabarit.** Ce challenge de validation est posé par le seed
> (`db_data/mykine-validation.json`) : il n'existe pas en production et n'a
> jamais eu de brief rédigé. Le contenu ci-dessous est repris du scénario déjà
> écrit — à étoffer si le challenge doit vivre.

Une application livrée ne se juge pas sur son code mais sur ce qu'elle fait
vivre à la personne qui l'utilise. Ce challenge fait parcourir le même scénario
d'usage à travers chaque application livrée sur le challenge source, étape par
étape.

## Objective

Dérouler les sept étapes du scénario sur l'application exposée, et marquer
chacune : réussie, bloquée, ou en échec.

L'étape 3 décide du reste : MyCoach a besoin de la caméra, et une iframe
multi-origine n'y a pas droit tant que la page hôte ne la délègue pas. Une
étape bloquée dans le cadre intégré se poursuit dans un onglet ; une caméra qui
ne démarre pas une fois dans l'onglet est un vrai résultat de validation.

## Expected result

- Une walkthrough complète, chaque étape marquée et commentée quand elle ne
  passe pas.
- Un retour global en clôture, qui dit si le parcours tient debout.
