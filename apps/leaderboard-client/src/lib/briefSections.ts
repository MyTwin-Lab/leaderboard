/**
 * Le brief d'un challenge, coupé en deux pour la page vitrine.
 *
 * La maquette ouvre sur un bloc « Why this challenge exists » — un titre en
 * serif puis quelques paragraphes — avant la colonne « The brief ». Le Lab n'a
 * qu'un texte pour les deux : le `brief.md` rédigé par l'admin, dont le
 * squelette proposé commence justement par `## Context`, décrit dans
 * `BRIEF_TEMPLATE` comme « why this challenge exists, and what problem it
 * addresses ». C'est donc cette section qui monte en tête de page, et le reste
 * du document qui reste dans la colonne de lecture.
 *
 * Aucun nouveau champ en base : le même texte, lu une seule fois, réparti sur
 * les deux emplacements de la maquette. Un brief sans section `Context` laisse
 * `why` vide — la page retombe alors sur la description du challenge.
 *
 * Pur, sans React : testable directement.
 */

export interface BriefSplit {
  /** Le corps de la section « Context », ou `null` s'il n'y en a pas. */
  why: string | null;
  /** Le reste du document, sections restantes dans leur ordre d'origine. */
  rest: string;
}

/** `## Context`, `## Contexte`, `## Context :` — la casse et la ponctuation ne comptent pas. */
function isContextHeading(title: string): boolean {
  return /^contexte?\b/i.test(title.trim().replace(/[:：.]+$/, ''));
}

/** Un titre de niveau 1 ou 2 ouvre une section ; `###` reste dans la sienne. */
function headingTitle(line: string): string | null {
  const match = line.match(/^#{1,2}\s+(.*)$/);
  return match ? match[1] : null;
}

export function splitBriefContext(markdown: string | null | undefined): BriefSplit {
  if (!markdown?.trim()) return { why: null, rest: '' };

  const lines = markdown.split('\n');
  const why: string[] = [];
  const rest: string[] = [];
  // `null` tant qu'aucun titre n'a été rencontré : ce qui précède le premier
  // titre appartient au document, pas à une section.
  let inContext = false;
  let seenContext = false;

  for (const line of lines) {
    const title = headingTitle(line);
    if (title !== null) {
      // Un seul `Context` est détourné : si l'admin en écrit deux, le second
      // reste dans la colonne de lecture plutôt que de s'empiler en tête.
      inContext = !seenContext && isContextHeading(title);
      if (inContext) {
        seenContext = true;
        // Le titre lui-même ne monte pas : la maquette le remplace par son
        // propre surtitre, « Why this challenge exists ».
        continue;
      }
    }
    (inContext ? why : rest).push(line);
  }

  const whyText = why.join('\n').trim();
  return { why: whyText || null, rest: rest.join('\n').trim() };
}

/**
 * Le texte « Why this challenge exists » tel que la maquette le compose : une
 * phrase d'accroche en serif, puis le reste en corps de texte.
 *
 * Le découpage se fait au premier paragraphe, seule frontière que le Markdown
 * offre ici — et celle que la maquette dessine.
 */
/**
 * Le balisage inline, retiré.
 *
 * L'accroche en serif de la maquette n'est pas rendue par `Markdown` : c'est un
 * titre, pas un paragraphe, et lui coller un gras ou un lien y serait du bruit.
 * Restait à ne pas afficher les astérisques d'un admin qui en écrit quand même.
 */
export function stripInlineMarkdown(text: string): string {
  return text
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Les chevrons d'une citation, retirés ligne à ligne — donc avant que les
    // retours à la ligne ne disparaissent. Sans ça, une citation de quatre
    // lignes arrive dans l'accroche recollée avec ses « > » au milieu.
    .replace(/^[ \t]*>[ \t]?/gm, '')
    // Un paragraphe de plusieurs lignes se lit sur une seule dans un titre.
    .replace(/\s*\n\s*/g, ' ')
    .trim();
}

export function leadAndBody(text: string): { lead: string; body: string[] } {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean);
  return { lead: paragraphs[0] ?? '', body: paragraphs.slice(1) };
}
