'use client';

/**
 * Rendu Markdown maison — extrait de DocumentsDrawer, qui en était le seul
 * consommateur jusqu'au brief de challenge.
 *
 * Volontairement minimal : titres, listes, citations, code, et l'inline
 * (gras, italique, code, liens). Pas de dépendance externe, pas de HTML
 * brut interprété — le contenu vient d'un document rédigé par un admin,
 * mais rien ici ne peut injecter de balise.
 *
 * Deux échelles typographiques :
 *  - `compact` : le tiroir Docs, où le document est lu dans un panneau
 *    latéral étroit. Classes identiques à l'implémentation d'origine.
 *  - `prose`   : le brief affiché pleine page avant de rejoindre un
 *    challenge, sur une colonne de lecture large.
 */

export type MarkdownVariant = 'compact' | 'prose';

interface VariantStyles {
  h1: string; h2: string; h3: string;
  p: string; ul: string; ol: string;
  li: string; bullet: string; marker: string;
  blockquote: string; pre: string; hr: string;
}

const STYLES: Record<MarkdownVariant, VariantStyles> = {
  compact: {
    h1: 'mt-5 mb-2 text-xl font-bold text-white',
    h2: 'mt-4 mb-1.5 text-base font-semibold text-white',
    h3: 'mt-3 mb-1 text-sm font-semibold text-white/90',
    p: 'my-1.5 text-sm leading-relaxed text-white/65',
    ul: 'my-2 space-y-1 text-sm text-white/70',
    ol: 'my-2 space-y-1 text-sm text-white/70',
    li: 'flex items-start gap-2',
    bullet: 'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brandCP/50',
    marker: 'mt-0.5 shrink-0 font-mono text-xs text-brandCP/50',
    blockquote: 'my-2 border-l-2 border-brandCP/40 pl-4 text-sm text-white/50 italic',
    pre: 'my-3 overflow-x-auto rounded-xl bg-white/[0.05] p-4 font-mono text-xs leading-relaxed text-white/75',
    hr: 'my-4 border-white/10',
  },
  prose: {
    h1: 'mt-8 mb-3 text-2xl font-semibold tracking-tight text-white',
    h2: 'mt-7 mb-2 text-xl font-semibold tracking-tight text-white first:mt-0',
    h3: 'mt-5 mb-1.5 text-base font-semibold text-white/90',
    p: 'my-2.5 text-[15px] leading-[1.75] text-white/60',
    ul: 'my-3 space-y-2 text-[15px] leading-relaxed text-white/60',
    ol: 'my-3 space-y-2 text-[15px] leading-relaxed text-white/60',
    li: 'flex items-start gap-2.5',
    bullet: 'mt-[9px] h-[5px] w-[5px] shrink-0 rounded-full bg-brandCP',
    marker: 'mt-px shrink-0 font-mono text-sm text-brandCP/70',
    blockquote: 'my-4 border-l-2 border-brandCP/35 pl-4 text-sm leading-[1.75] text-white/45',
    pre: 'my-4 overflow-x-auto rounded-xl bg-white/[0.05] p-4 font-mono text-xs leading-relaxed text-white/75',
    hr: 'my-6 border-white/10',
  },
};

function inlineRender(text: string): React.ReactNode {
  // Process inline: bold, italic, inline-code, links
  const parts: React.ReactNode[] = [];
  let rest = text;
  let key = 0;

  while (rest.length > 0) {
    const codeMatch = rest.match(/^([\s\S]*?)(`[^`]+`)/);
    const boldMatch = rest.match(/^([\s\S]*?)(\*\*[^*]+\*\*)/);
    const italicMatch = rest.match(/^([\s\S]*?)(\*[^*]+\*)/);
    const linkMatch = rest.match(/^([\s\S]*?)(\[[^\]]+\]\([^)]+\))/);

    const candidates = [codeMatch, boldMatch, italicMatch, linkMatch]
      .filter(Boolean)
      .sort((a, b) => (a![1].length) - (b![1].length));

    if (candidates.length === 0) {
      parts.push(rest);
      break;
    }

    const match = candidates[0]!;
    if (match[1]) parts.push(match[1]);

    const token = match[2];
    if (token.startsWith('`')) {
      parts.push(<code key={key++} className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[0.85em] text-brandCP/80">{token.slice(1, -1)}</code>);
    } else if (token.startsWith('**')) {
      parts.push(<strong key={key++} className="font-semibold text-white">{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('*')) {
      parts.push(<em key={key++} className="italic text-white/80">{token.slice(1, -1)}</em>);
    } else if (token.startsWith('[')) {
      const linkText = token.match(/\[([^\]]+)\]/)?.[1] ?? '';
      const linkHref = token.match(/\(([^)]+)\)/)?.[1] ?? '';
      parts.push(
        <a key={key++} href={linkHref} target="_blank" rel="noopener noreferrer"
          className="text-brandCP underline underline-offset-2 hover:text-brandCP/70">
          {linkText}
        </a>
      );
    }

    rest = rest.slice(match[1].length + token.length);
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

export function renderMarkdown(md: string, variant: MarkdownVariant = 'compact'): React.ReactNode[] {
  const s = STYLES[variant];
  const lines = md.split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      nodes.push(
        <pre key={i} className={s.pre}>
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      i++;
      continue;
    }

    // Headings
    const h3 = line.match(/^###\s+(.*)/);
    const h2 = line.match(/^##\s+(.*)/);
    const h1 = line.match(/^#\s+(.*)/);

    if (h1) {
      nodes.push(<h1 key={i} className={s.h1}>{inlineRender(h1[1])}</h1>);
      i++; continue;
    }
    if (h2) {
      nodes.push(<h2 key={i} className={s.h2}>{inlineRender(h2[1])}</h2>);
      i++; continue;
    }
    if (h3) {
      nodes.push(<h3 key={i} className={s.h3}>{inlineRender(h3[1])}</h3>);
      i++; continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      nodes.push(<hr key={i} className={s.hr} />);
      i++; continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      nodes.push(
        <blockquote key={i} className={s.blockquote}>
          {inlineRender(line.slice(2))}
        </blockquote>
      );
      i++; continue;
    }

    // Unordered list item
    const ulItem = line.match(/^[-*]\s+(.*)/);
    if (ulItem) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && lines[i].match(/^[-*]\s+(.*)/)) {
        const m = lines[i].match(/^[-*]\s+(.*)/)!;
        items.push(<li key={i} className={s.li}><span className={s.bullet} /><span>{inlineRender(m[1])}</span></li>);
        i++;
      }
      nodes.push(<ul key={`ul-${i}`} className={s.ul}>{items}</ul>);
      continue;
    }

    // Ordered list item
    const olItem = line.match(/^\d+\.\s+(.*)/);
    if (olItem) {
      const items: React.ReactNode[] = [];
      let idx = 1;
      while (i < lines.length && lines[i].match(/^\d+\.\s+(.*)/)) {
        const m = lines[i].match(/^\d+\.\s+(.*)/)!;
        items.push(<li key={i} className={s.li}><span className={s.marker}>{idx++}.</span><span>{inlineRender(m[1])}</span></li>);
        i++;
      }
      nodes.push(<ol key={`ol-${i}`} className={s.ol}>{items}</ol>);
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      i++; continue;
    }

    // Normal paragraph
    nodes.push(<p key={i} className={s.p}>{inlineRender(line)}</p>);
    i++;
  }

  return nodes;
}

export function Markdown({ source, variant = 'compact' }: { source: string; variant?: MarkdownVariant }) {
  return <>{renderMarkdown(source, variant)}</>;
}
