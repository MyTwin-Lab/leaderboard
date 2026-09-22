## Context

Un modèle qui annonce 94 % d'exactitude n'a encore convaincu personne au bloc.

Une métrique se calcule sur le jeu de test qu'on lui a choisi. Elle ne dit rien de ce que le modèle répond sur une IRM mal cadrée, sur un genou déjà opéré, ou sur le cas limite que le radiologue reconnaît en une seconde et que personne n'a pensé à annoter.

Ce challenge fait passer les API du challenge ML devant des professionnels de santé qualifiés. Chaque verdict est rendu par une personne dont la qualification a été vérifiée, sur un cas de référence dont la vérité terrain est connue d'elle seule au moment où elle répond.

## Objective

Ce qu'il faut livrer :

- Réclamer un cas de référence, interroger l'API cible et lire sa réponse comme vous liriez celle d'un confrère.
- Rendre un verdict — la réponse tient, ou elle ne tient pas — et dire en une phrase ce qui l'emporte.
- Signaler les cas où l'API échoue autrement qu'en se trompant : délai, erreur technique, réponse hors format.

## Expected result

- Un verdict par cas réclamé, avec l'observation qui le justifie.
- Les cas litigieux remontés plutôt que tranchés : un désaccord documenté vaut mieux qu'un vote de confort.
