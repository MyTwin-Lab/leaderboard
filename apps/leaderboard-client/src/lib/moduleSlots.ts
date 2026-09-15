import type { ComponentType } from 'react';

/**
 * Slots d'interface des modules (challenge 020, L6)
 * -------------------------------------------------
 * Ce qu'un module place dans les écrans du shell. Les écrans ne nomment aucun
 * module : ils rendent les slots des modules actifs
 * (`useModuleSlots`, `@/distribution/mytwin.modules`), et un module désactivé
 * n'y laisse rien — ni section, ni entrée de menu, ni requête.
 *
 * Chaque slot charge lui-même ses données, par les routes du module : un
 * écran du shell n'a pas à connaître leur forme.
 */

export interface ModuleChallengeSectionProps {
  challengeId: string;
  /** Admin, ou membre du challenge : ceux à qui la page montre ses coulisses. */
  canSeeInternals: boolean;
}

export interface ModuleAdminNavItem {
  href: string;
  label: string;
}

export interface ModuleNavItem {
  href: string;
  label: string;
}

export interface ModuleSlots {
  /** La clé du module (`ModuleDefinition.key`), dont l'état décide de l'affichage. */
  key: string;
  /** Entrées de la navigation publique (barre du haut et pied de page), avant celles du core. */
  publicNav?: readonly ModuleNavItem[];
  /** Au-dessus des onglets de la page d'un challenge, pour un visiteur connecté. */
  ChallengeSection?: ComponentType<ModuleChallengeSectionProps>;
  /** Au-dessus des onglets de la vue de pilotage (admin et managers). */
  ManageSection?: ComponentType<{ challengeId: string }>;
  /** Entrées du menu d'administration, après celles du core. */
  adminNav?: readonly ModuleAdminNavItem[];
  /** Une carte chiffrée de l'onglet « Overview » de l'accueil admin. */
  AdminStat?: ComponentType;
  /** Un onglet de l'accueil admin, après ceux du core. */
  adminTab?: { label: string; Panel: ComponentType };
}

/** Ce que `GET /api/modules` rend, et ce que les slots en lisent. */
export interface ModulesResponse {
  modules: Array<{ key: string; label: string; description: string | null; enabled: boolean }>;
}
