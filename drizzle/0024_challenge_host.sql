-- L'hôte d'un challenge : qui le porte, et signe les verdicts.
--
-- Miroir documentaire. En production, c'est scripts/db-apply-schema.ts qui
-- applique ces changements.
--
-- Une seule colonne, en texte libre : c'est une phrase lue par le visiteur
-- (« CHU de Montpellier, service de médecine physique et de réadaptation »),
-- pas une référence vers une table de partenaires — le Lab n'en a pas, et une
-- table à une colonne ne dirait rien de plus. NULL = la carte « Who hosts this
-- challenge » ne s'affiche pas.

ALTER TABLE "challenges" ADD COLUMN IF NOT EXISTS "host" text;
