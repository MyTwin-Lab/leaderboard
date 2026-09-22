## Context

Un genou qui gonfle attend six semaines avant qu'on sache ce qu'il a.

L'IRM est prescrite le jour de la consultation, lue quelques semaines plus tard, et le compte rendu arrive quand le patient a déjà commencé — ou renoncé à — sa rééducation. Entre les deux, personne ne sait si le ligament croisé est rompu, distendu ou intact, et le protocole se décide au doute.

Les jeux de données annotés existent désormais en quantité suffisante pour qu'un modèle propose une première lecture le jour de l'examen. Ce challenge construit ce modèle, et surtout l'API derrière laquelle un clinicien pourra le mettre à l'épreuve.

## Objective

Ce qu'il faut livrer :

- Un modèle de détection de lésion ligamentaire à partir d'une IRM du genou, entraîné sur le dataset du challenge.
- Un packaging derrière une API : une image, une réponse, une latence mesurée.
- Une carte de modèle : données d'entraînement, métrique retenue, limites connues et cas où il ne faut pas s'y fier.

## Expected result

- Le modèle publié sur le dépôt du challenge, avec le code d'entraînement qui permet de le reproduire.
- Un endpoint joignable, documenté par un exemple de requête et de réponse.
- Un rapport de performance par classe, comparé à la référence annotée du challenge.
