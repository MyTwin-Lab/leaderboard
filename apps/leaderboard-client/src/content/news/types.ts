import type { ComponentType, ReactNode } from "react";

/**
 * Une news du Lab, écrite en TSX et non en markdown : sections ancrées, encadré
 * « At a glance », blocs visuels propres à l'article, sources et entités
 * balisées. Le gabarit (`components/news/`) donne la même grammaire à toutes ;
 * chaque article ne dessine que ce que son contenu montre mieux qu'il ne le
 * raconte. Règles éditoriales : `docs/news-playbook.md`.
 */

/** Le type d'événement : il choisit la pastille, et rien d'autre. */
export type NewsCategory = "partnership" | "challenge" | "sandbox" | "research" | "community";

export const NEWS_CATEGORY_LABELS: Record<NewsCategory, string> = {
  partnership: "Partnership",
  challenge: "Challenge",
  sandbox: "Sandbox",
  research: "Research",
  community: "Community",
};

export type NewsSection = {
  /** Ancre du sommaire, stable : un lien partagé vers une section y mène. */
  id: string;
  title: string;
  content: ReactNode;
};

export type NewsFact = {
  label: string;
  value: ReactNode;
};

export type NewsFaqItem = {
  question: string;
  /** Texte brut et non JSX : la même chaîne alimente la page et le JSON-LD. */
  answer: string;
};

export type NewsSource = {
  label: string;
  url: string;
};

/**
 * Une entité que l'article nomme (partenaire, technologie, institution) :
 * déclarée en `mentions` dans le JSON-LD, avec son site. C'est le lien
 * MyTwin → partenaire que la news construit, écrit pour les moteurs.
 */
export type NewsMention = {
  type: "Organization" | "Person" | "SoftwareApplication";
  name: string;
  url?: string;
};

export type NewsCta = {
  text: string;
  label: string;
  /** `/…` pour une page du Lab, URL complète pour un autre site. */
  href: string;
};

/**
 * L'illustration d'une news dans ses aperçus (les cartes) : une image, ou
 * un visuel dessiné en HTML/SVG. Même règle qu'un bloc visuel : elle illustre
 * et n'ajoute rien, ni chiffre ni résultat qui ne soit dans l'article.
 */
export type NewsIllustration =
  | {
      kind: "image";
      /** Dans `public/news/`, ou une image déjà servie par le site. */
      src: string;
      /** Pour une image montrée seule. Dans une carte, le titre suffit : elle y est décorative. */
      alt: string;
      /** `object-position` : le cadre des aperçus est paysage, l'image est recadrée. */
      position?: string;
      /**
       * `contain` : l'image paraît en entier, un peu en retrait et cernée d'un
       * filet, au centre d'un fond noir qui complète le cadre (une
       * radiographie, dont le fond est déjà noir).
       */
      fit?: "cover" | "contain";
      /** Largeur / hauteur de l'image, pour `fit: "contain"` : le filet épouse l'image. 1 par défaut. */
      ratio?: number;
    }
  | {
      kind: "visual";
      /** Dessiné pour le panneau clair du cadre, en `em` : il suit la largeur du cadre. */
      Visual: ComponentType;
    };

/**
 * Une vidéo dont la news rend compte (une intervention, une conférence),
 * servie par le site : l'article la place dans son texte avec
 * `NewsVideoEmbed`, et la page la déclare en `video` dans le JSON-LD.
 */
export type NewsVideo = {
  /** Dans `public/news/` : MP4 H.264 en `faststart`, la lecture démarre sans attendre le fichier entier. */
  src: string;
  /** Une image de la vidéo, dans `public/news/` : seule chargée avant le clic. */
  poster: string;
  title: string;
  /** Ce qu'on y voit, pour le JSON-LD. */
  description: string;
  /** Durée ISO 8601 (`PT15M29S`), pour le JSON-LD. */
  duration: string;
  /** Mise en ligne sur le Lab (`AAAA-MM-JJ`) : la date de publication de la news. */
  uploadDate: string;
  /** Code BCP 47 de la langue parlée (`fr`), dite sous la vidéo si ce n'est pas l'anglais. */
  language: string;
};

export type NewsArticle = {
  /** Anglais, court, sans date : l'URL survit aux mises à jour de l'article. */
  slug: string;
  /** Le jour où l'article paraît sur le Lab — jamais antidaté. */
  publishedAt: string;
  /** Seulement quand le fond change : c'est la date du sitemap et de `dateModified`. */
  updatedAt?: string;
  /**
   * Le mois où l'événement a eu lieu (`AAAA-MM`), qui peut précéder la
   * publication de loin. C'est lui qui ordonne les news et s'affiche sur les
   * cartes : une news raconte un moment de l'histoire du Lab.
   */
  eventMonth: string;
  category: NewsCategory;
  readingMinutes: number;
  /** Le H1. */
  title: string;
  /**
   * Le titre des aperçus (les cartes) : plus court et plus accrocheur que
   * le H1, qui garde l'entité et l'événement pour le référencement.
   */
  overviewTitle: string;
  /** Sans illustration, l'aperçu reste en texte seul. */
  illustration?: NewsIllustration;
  /** Sans « | MyTwin Lab », ajouté par la page : ≤ ~48 caractères. */
  seoTitle: string;
  /** ≤ ~155 caractères. */
  description: string;
  /** Le chapeau sous le H1, et le résumé des cartes. */
  excerpt: string;
  keywords: string[];
  facts: NewsFact[];
  intro: ReactNode;
  sections: NewsSection[];
  /** Seulement s'il y a de vraies questions : une news ne se rembourre pas. */
  faq?: NewsFaqItem[];
  cta: NewsCta;
  /** La vidéo dont la news rend compte, s'il y en a une. */
  video?: NewsVideo;
  sources: NewsSource[];
  mentions: NewsMention[];
};
