// Vitest global setup
import { PlatformRegistry } from '../../../../packages/registry/platform';
import { platform } from '../distribution/mytwin.platform';

// Les tests de l'app tournent avec la plateforme MyTwin installée, comme le
// serveur après son démarrage (`instrumentation.ts`). Un test qui vérifie
// l'installation elle-même réinitialise le registre ; le fichier suivant le
// retrouve installé.
if (!PlatformRegistry.isInstalled()) {
  PlatformRegistry.install(platform);
}

// `next/font/google` ne s'exécute que dans le build Next : sous Vitest, tout
// composant qui passe par `components/vitrine/fonts.ts` (le tiroir, la modale,
// donc tout ce qu'un module de la distribution monte) cassait la collecte.
// Chaque famille devient une fonction qui rend des classes vides. Vitest veut
// des exports nommés, pas un Proxy : les familles sont listées.
vi.mock('next/font/google', () => {
  const font = (name: string) => () => ({ variable: `font-${name}`, className: '', style: {} });
  return {
    Plus_Jakarta_Sans: font('plus-jakarta-sans'),
    Hanken_Grotesk: font('hanken-grotesk'),
    Instrument_Serif: font('instrument-serif'),
    Geist: font('geist'),
    Geist_Mono: font('geist-mono'),
  };
});
