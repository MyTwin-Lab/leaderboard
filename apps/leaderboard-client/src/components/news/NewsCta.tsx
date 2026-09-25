import Link from "next/link";

import type { NewsCta as NewsCtaData } from "@/content/news/types";
import { NewsArrowRightIcon } from "./NewsIcons";

/**
 * Le surtitre de la bannière — « Open challenge » dans la maquette — dit où
 * mène le bouton, et se lit donc sur sa destination : une news de partenariat
 * qui renvoie vers MyTwin n'a pas à s'annoncer « Partnership ». Rien n'est
 * ajouté au contenu des news : c'est une étiquette du gabarit, comme
 * « At a glance » ou « Key takeaway ».
 */
function ctaEyebrow(href: string): string {
  if (href.startsWith("/challenges")) return "Open challenge";
  if (href.startsWith("/sandbox")) return "Sandbox";
  if (href.startsWith("/vision")) return "Research vision";
  return "MyTwin";
}

/**
 * Un seul appel à l'action, en fin d'article, et c'est l'action que la news
 * rend possible : rejoindre le challenge, soutenir le projet, découvrir MyTwin.
 * Au milieu du texte, il ferait d'une news une page de vente.
 *
 * Les pages de mytwin.care passent par un `<a>` : `next/link` ne sert que ce
 * site.
 */
export function NewsCta({ cta }: { cta: NewsCtaData }) {
  const external = cta.href.startsWith("http");
  const button = (
    <>
      {cta.label}
      <NewsArrowRightIcon />
    </>
  );

  return (
    <aside className="v-nd-cta">
      <div className="v-nd-cta-text">
        <span className="v-nd-cta-label">{ctaEyebrow(cta.href)}</span>
        <p className="v-nd-cta-title">{cta.text}</p>
      </div>

      {external ? (
        <a href={cta.href} className="v-nd-cta-btn">
          {button}
        </a>
      ) : (
        <Link href={cta.href} className="v-nd-cta-btn">
          {button}
        </Link>
      )}
    </aside>
  );
}
