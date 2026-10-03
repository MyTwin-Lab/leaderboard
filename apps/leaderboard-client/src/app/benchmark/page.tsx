import { BenchmarkVitrine } from "@/components/benchmark/BenchmarkVitrine";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, jsonLdGraph, pageMetadata, webPageJsonLd } from "@/lib/seo";

const PATH = "/benchmark";
const TITLE = "Human Digital Twin Maturity Benchmark";
const DESCRIPTION =
  "An open, evidence-based framework to measure the maturity of human digital twins across 10 dimensions, from personalization to governance and safety.";

// Le titre porte « human digital twin », le territoire du Lab — jamais
// « health digital twin », qui reste à mytwin.care (cf. docs/seo.md, Decisions).
export const metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: PATH });

/**
 * Le benchmark de maturité des jumeaux numériques humains — **page publique**,
 * entièrement statique, comme `/vision` : rien à lire en base.
 *
 * Elle n'est pas dans la navbar : on y arrive par la section « Benchmark » de
 * l'accueil, et par le sitemap.
 */
export default function BenchmarkPage() {
  return (
    <>
      <JsonLd
        data={jsonLdGraph(
          webPageJsonLd({ path: PATH, name: TITLE, description: DESCRIPTION }),
          breadcrumbJsonLd([
            { name: "MyTwin Lab", path: "/" },
            { name: "Benchmark", path: PATH },
          ]),
        )}
      />
      <BenchmarkVitrine />
    </>
  );
}
