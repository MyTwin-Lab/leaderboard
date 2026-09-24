import { VisionVitrine } from "@/components/vision/VisionVitrine";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Our Research Vision",
  description:
    "One person, one evolving digital twin: connecting health data and scientific models to represent each person over time, from the body to the molecule.",
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
