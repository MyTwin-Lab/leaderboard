/**
 * La photo ronde des maquettes : `object-fit: cover`, un liseré de la couleur
 * de la surface, et les initiales quand la personne n'a pas de photo.
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

export function VitrineAvatar({ name, avatarUrl, size, ring = true }: VitrineAvatarProps) {
  const base: React.CSSProperties = {
    width: size,
    height: size,
    flexShrink: 0,
    borderRadius: "999px",
    boxShadow: ring ? "0 0 0 2px var(--v-surface)" : undefined,
  };

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- source libre (GitHub, Google, /api/images)
      <img src={avatarUrl} alt="" aria-hidden="true" style={{ ...base, objectFit: "cover" }} />
    );
  }

  return (
    <span
      aria-hidden="true"
      style={{
        ...base,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgb(11 122 100 / 0.12)",
        color: "var(--v-accent)",
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
