-- Un sandbox est un **projet**, plus un challenge en attente.
--
-- Ce que la table perd, et pourquoi :
--
--   * `type` — `code` / `ml` est le vocabulaire des challenges. Une proposition
--     n'a plus à choisir la forme que prendra le travail ; c'est l'admin qui
--     tranche au moment de la promotion, dans le tiroir de création.
--
--   * `repo_url`, `model_url`, `dataset_urls` — une proposition est une idée,
--     pas un début de livrable. Rien n'est demandé à l'auteur de ce côté-là :
--     les repos sont créés à la promotion, sur le challenge.
--
--   * `evaluation`, `evaluation_status`, `evaluated_at` — l'évaluation
--     formative notait le dépôt de l'auteur sur la grille `code`, c'est-à-dire
--     qu'elle lisait une proposition comme un challenge. Sans dépôt elle n'a
--     plus de sujet, sans type plus de grille. Ce qui fait avancer un projet
--     ici, ce sont ses stars et la promotion — pas une note.
--
-- Reste donc ce qu'une proposition raconte : titre, adresse, contexte, buts,
-- pourquoi, couverture — et son économie de stars, intacte.
ALTER TABLE "sandboxes" DROP COLUMN IF EXISTS "type";
--> statement-breakpoint
ALTER TABLE "sandboxes" DROP COLUMN IF EXISTS "repo_url";
--> statement-breakpoint
ALTER TABLE "sandboxes" DROP COLUMN IF EXISTS "model_url";
--> statement-breakpoint
ALTER TABLE "sandboxes" DROP COLUMN IF EXISTS "dataset_urls";
--> statement-breakpoint
ALTER TABLE "sandboxes" DROP COLUMN IF EXISTS "evaluation";
--> statement-breakpoint
ALTER TABLE "sandboxes" DROP COLUMN IF EXISTS "evaluation_status";
--> statement-breakpoint
ALTER TABLE "sandboxes" DROP COLUMN IF EXISTS "evaluated_at";
