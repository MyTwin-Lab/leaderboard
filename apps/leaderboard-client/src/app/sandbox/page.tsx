import { SandboxExplorer } from "@/components/sandbox/SandboxExplorer";

export const metadata = {
  title: "Sandbox",
  description:
    "Community proposals in the health domain - star what you want built, and see the best ones promoted into official challenges.",
};

/**
 * Le listing des propositions — **page publique**.
 *
 * Composant serveur sans lecture : tout est fetché par `SandboxExplorer`, côté
 * client. Ce n'est pas une facilité, c'est ce que la page demande — l'état du
 * visiteur (sa star, ses propositions, son droit de créer) dépend de sa
 * session, et `/api/sandboxes/**` étant hors du matcher du proxy, c'est le
 * `meQuery` du composant qui déclenche le refresh silencieux d'un jeton
 * expiré. Un rendu serveur ici cacherait cet état pour tout le monde.
 */
export default function SandboxPage() {
  return <SandboxExplorer />;
}
