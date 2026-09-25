import { NewsFigure } from "@/components/news/NewsFigure";

// Un squelette simplifié de profil, en bas d'un squat, dans un repère
// 200 × 260. Illustratif : ni les 33 points réels du modèle, ni une mesure.
const JOINTS = {
  head: [74, 36],
  neck: [82, 62],
  shoulder: [86, 72],
  elbow: [120, 98],
  wrist: [152, 100],
  hip: [58, 150],
  knee: [122, 164],
  ankle: [104, 232],
  toe: [134, 238],
} as const;

type Joint = keyof typeof JOINTS;

const BONES: [Joint, Joint][] = [
  ["neck", "shoulder"],
  ["shoulder", "elbow"],
  ["elbow", "wrist"],
  ["shoulder", "hip"],
  ["hip", "knee"],
  ["knee", "ankle"],
  ["ankle", "toe"],
];

// Chaque étape reprend une phrase de la section « How MyKine measures a
// session ».
const STEPS = [
  { title: "Camera", text: "The phone films the exercise." },
  { title: "Pose model", text: "Body landmarks, tracked on the phone." },
  { title: "Angles and reps", text: "Explicit thresholds per exercise." },
  { title: "Session summary", text: "Plus a skeleton replay of each set." },
];

// Les couleurs sont écrites ici, et non prises à une classe : le squelette est
// un dessin, pas du texte, et il doit tenir sur la surface claire de la page.
const BONE = "#11161a";
const ACCENT = "#3FA1AA";

function Skeleton() {
  const [kx, ky] = JOINTS.knee;
  return (
    <svg
      viewBox="0 0 200 260"
      role="img"
      aria-label="A body skeleton at the bottom of a squat, with the knee angle highlighted"
      className="h-56 w-auto sm:h-64"
    >
      <g stroke={BONE} strokeOpacity="0.22" strokeWidth="5" strokeLinecap="round">
        {BONES.map(([from, to]) => (
          <line key={`${from}-${to}`} x1={JOINTS[from][0]} y1={JOINTS[from][1]} x2={JOINTS[to][0]} y2={JOINTS[to][1]} />
        ))}
      </g>
      <circle cx={JOINTS.head[0]} cy={JOINTS.head[1]} r="16" fill="none" stroke={BONE} strokeOpacity="0.22" strokeWidth="5" />
      {/* L'angle mesuré au genou, entre la cuisse et la jambe : c'est ce que le
          score compare au seuil de l'exercice. */}
      <path d={`M ${kx - 25} ${ky - 6} A 26 26 0 0 0 ${kx - 7} ${ky + 25}`} fill="none" stroke={ACCENT} strokeWidth="3" />
      <g fill={ACCENT}>
        {Object.entries(JOINTS)
          .filter(([name]) => name !== "head")
          .map(([name, [x, y]]) => (
            <circle key={name} cx={x} cy={y} r={name === "knee" ? 7 : 5} />
          ))}
      </g>
    </svg>
  );
}

export function OnDevicePipeline() {
  return (
    <NewsFigure caption="Everything happens on the phone: the video is used to find the body landmarks, and never leaves the device.">
      <div className="v-nd-panel" data-split="true">
        <Skeleton />
        <div className="v-nd-tile" data-bare="true">
          <span className="v-nd-tile-label" data-accent="true">
            On the phone
          </span>
          <ol className="v-nd-steps">
            {STEPS.map((step, index) => (
              <li key={step.title}>
                <span className="v-nd-step-num">{index + 1}</span>
                <span>
                  <b>{step.title}</b> · {step.text}
                </span>
              </li>
            ))}
          </ol>
          <p className="v-nd-note">
            <b>Leaves the phone:</b> no image, no video.
          </p>
        </div>
      </div>
    </NewsFigure>
  );
}
