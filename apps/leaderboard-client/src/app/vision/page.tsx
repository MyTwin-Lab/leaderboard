import { VisionVitrine } from "@/components/vision/VisionVitrine";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Human Digital Twin Research Vision",
  description:
    "Discover MyTwin Lab’s research vision for an evolving human digital twin connecting health data and scientific models from body to molecule.",
  path: "/vision",
});

/**
 * La vision de recherche du Lab — **page publique**, entièrement statique.
 *
 * Rien à lire en base : la page ne porte que le propos, et le contenu vit
 * dans le composant. Pas de `force-dynamic` donc, contrairement à l'accueil.
 */
export default function VisionPage() {
  return <VisionVitrine />;
}
