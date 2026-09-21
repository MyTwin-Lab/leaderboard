// i-Virtual : une vidéo selfie de 30 secondes, dont la caméra tire l'onde de
// pouls. L'onde est une forme de pouls générique, pas une mesure, et aucun
// chiffre n'est affiché : le visuel illustre, il n'invente pas de résultat.

// Un battement stylisé, large de 50 unités, qui revient à la ligne de base :
// répété, il défile sans raccord (voir `l-scan-wave`).
const BEAT = "l 10 0 l 7 -30 l 7 26 l 5 -7 l 7 9 l 14 2";
const WAVE = `M 0 206 ${Array.from({ length: 8 }, () => BEAT).join(" ")}`;

export function CameraCheckupVisual() {
  return (
    <div className="l-scan" aria-hidden>
      <svg viewBox="0 0 320 240" preserveAspectRatio="xMidYMid slice" fill="none">
        <defs>
          <clipPath id="l-scan-frame">
            <circle cx="160" cy="96" r="58" />
          </clipPath>
          <linearGradient id="l-scan-fade" x1="0" x2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.3" stopColor="#fff" />
            <stop offset="0.7" stopColor="#fff" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <mask id="l-scan-wave-mask">
            <rect x="40" y="160" width="240" height="60" fill="url(#l-scan-fade)" />
          </mask>
        </defs>

        <circle className="l-scan__track" cx="160" cy="96" r="64" />
        <circle
          className="l-scan__progress"
          cx="160"
          cy="96"
          r="64"
          pathLength={100}
          transform="rotate(-90 160 96)"
        />

        <ellipse className="l-scan__skin" cx="160" cy="86" rx="21" ry="26" />
        <g className="l-scan__face" clipPath="url(#l-scan-frame)">
          <ellipse cx="160" cy="86" rx="21" ry="26" />
          <path d="M 108 170 C 110 138 134 122 160 122 C 186 122 210 138 212 170" />
        </g>

        <g mask="url(#l-scan-wave-mask)">
          <path className="l-scan__wave" d={WAVE} />
        </g>
      </svg>

      <div className="l-scan__chip">
        <small>
          <i />
          Selfie video
        </small>
        30 seconds
      </div>
    </div>
  );
}
