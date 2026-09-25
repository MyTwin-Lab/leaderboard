import { _layout } from "blobatar";

/**
 * La photo ronde des maquettes : `object-fit: cover`, un liseré de la couleur
 * de la surface, et de quoi tenir la place quand la personne n'a pas de photo.
 *
 * Le même rond partout où une vitrine nomme quelqu'un — le classement,
 * l'accueil, les cartes de `/challenges` et de `/sandbox`, la page d'un
 * challenge et celle d'une sandbox : initiales sombres sur une pastille tirée
 * du nom. Il n'y a plus de second repli : deux ronds verts identiques ne
 * distinguaient pas deux voisins d'une liste.
 *
 * Volontairement distinct d'`InitialsAvatar`, qui porte les rayons et les
 * couleurs du thème du Lab : ici, ce sont ceux de la maquette.
 */
interface VitrineAvatarProps {
  name: string;
  avatarUrl?: string | null;
  /** Le diamètre, en `rem` — comme la maquette l'exprime. */
  size: string;
  /** Le liseré de la maquette, absent sur les avatars posés sur une photo. */
  ring?: boolean;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
    .padEnd(2, "?");
}

/** Deux couleurs hex mélangées, `ratio` étant la part de la première. */
function mix(a: string, b: string, ratio: number) {
  const channel = (hex: string, at: number) => parseInt(hex.slice(at, at + 2), 16);
  const blend = (at: number) =>
    Math.round(channel(a, at) * ratio + channel(b, at) * (1 - ratio))
      .toString(16)
      .padStart(2, "0");
  return `#${blend(1)}${blend(3)}${blend(5)}`;
}

/**
 * Le rond d'une personne sans photo, tiré de son nom.
 *
 * Les teintes viennent de `blobatar`, la bibliothèque des avatars à yeux : son
 * `_layout` rend la palette qu'elle aurait peinte — une couleur de corps et une
 * encre assortie — sans dessiner la figure. On ne garde que les couleurs, les
 * initiales restent. C'est la graine qui change d'une personne à l'autre, pas
 * la recette : la clarté et la saturation sont des constantes de la
 * bibliothèque, donc deux ronds voisins se ressemblent sans se confondre.
 *
 * Le corps est ramené vers le blanc : la bibliothèque le sort à des
 * saturations très variables (un ocre franc à côté d'un rose déjà pâle), et
 * sous deux lettres il faut un fond qui reste en retrait. L'encre, elle, est
 * prise telle quelle — elle est calculée pour contraster avec sa propre teinte.
 */
const PASTEL_WHITENING = 0.38;

function pastelFromName(name: string) {
  const palette = _layout(name, { background: false }).palette;
  const head = palette.head ?? "#8b9196";
  const eye = palette.eye ?? "#11161a";
  return { background: mix(head, "#ffffff", PASTEL_WHITENING), color: eye };
}

export function VitrineAvatar({ name, avatarUrl, size, ring = true }: VitrineAvatarProps) {
  const base: React.CSSProperties = {
    width: size,
    height: size,
    flexShrink: 0,
    // Deux règles posent `max-width: 100%` sur les images — le preflight de
    // Tailwind et celui de la vitrine — et `max-width` écrase `width`, même
    // en style inline : ce sont deux propriétés, pas deux déclarations en
    // concurrence. Le pourcentage se résout sur le bloc conteneur, donc un
    // rond seul dans une pile d'avatars plus étroite que lui (les marges
    // négatives de `.v-ch-team`) se faisait raboter les côtés et rendait une
    // ellipse. Ici le diamètre est explicite : rien n'a à le contraindre.
    maxWidth: "none",
    borderRadius: "999px",
    boxShadow: ring ? "0 0 0 2px var(--v-surface)" : undefined,
  };

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- source libre (GitHub, Google, /api/images)
      <img src={avatarUrl} alt="" aria-hidden="true" style={{ ...base, objectFit: "cover" }} />
    );
  }

  const tint = pastelFromName(name);

  return (
    <span
      aria-hidden="true"
      style={{
        ...base,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: tint.background,
        color: tint.color,
        fontFamily: "var(--v-font-h)",
        fontWeight: 700,
        fontSize: `calc(${size} * 0.36)`,
        letterSpacing: "-0.01em",
      }}
    >
      {initials(name)}
    </span>
  );
}
