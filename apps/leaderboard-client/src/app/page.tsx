import { Landing } from "@/components/landing/Landing";
import { JsonLd } from "@/components/seo/JsonLd";
import { DEFAULT_DESCRIPTION, jsonLdGraph, labOrganizationJsonLd, pageMetadata, websiteJsonLd } from "@/lib/seo";

// Le titre de la racine commence par la marque : c'est la page qui doit
// sortir sur la requête « MyTwin Lab », et elle porte le JSON-LD de l'entité.
// « Digital twin » est laissé à mytwin.care, qui porte ce territoire : jamais
// dans un titre. L'accueil du Lab (contributeurs, challenges, news) vit
// désormais sur `/home`.
export const metadata = pageMetadata({
  absoluteTitle: "MyTwin Lab | Open Health Innovation Community",
  description: DEFAULT_DESCRIPTION,
  path: "/",
});

// La landing a sa propre DA, hors du système de thème : elle sort du chrome du
// Lab (`LabShell`) et tout son rendu vit dans `components/landing/`.
export default function LandingPage() {
  return (
    <>
      <JsonLd data={jsonLdGraph(labOrganizationJsonLd(), websiteJsonLd())} />
      <Landing />
    </>
  );
}
