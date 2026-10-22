import { notFound } from "next/navigation";

import { ModuleSpecificationView } from "@/components/marketplace/ModuleSpecificationView";
import { MARKETPLACE_MODULES, getMarketplaceModule, moduleNumber } from "@/content/marketplace";
import { marketplaceModulePath } from "@/lib/paths";
import { unindexedMetadata, unlistedMetadata } from "@/lib/seo";

type ModulePageProps = { params: Promise<{ slug: string }> };

// Le registre est dans le code : un slug qu'il ne connaît pas est un 404,
// pas une page à résoudre au runtime.
export const dynamicParams = false;

export function generateStaticParams() {
  return MARKETPLACE_MODULES.map((module) => ({ slug: module.slug }));
}

export async function generateMetadata({ params }: ModulePageProps) {
  const found = getMarketplaceModule((await params).slug);
  if (!found) return unindexedMetadata("MyTwin Marketplace");

  return unlistedMetadata({
    title: found.name,
    description: found.shortDescription,
    path: marketplaceModulePath(found.slug),
  });
}

/** `/marketplace/<slug>` — la fiche d'un module, une seule page pour les dix. */
export default async function MarketplaceModulePage({ params }: ModulePageProps) {
  const found = getMarketplaceModule((await params).slug);
  if (!found) notFound();

  const index = MARKETPLACE_MODULES.indexOf(found);

  return (
    <ModuleSpecificationView
      module={found}
      number={moduleNumber(found)}
      previous={MARKETPLACE_MODULES[index - 1]}
      next={MARKETPLACE_MODULES[index + 1]}
    />
  );
}
