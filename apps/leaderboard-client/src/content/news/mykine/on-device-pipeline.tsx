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

// Le squelette s'estompe par l'opacité et non par `text-white/35` : en mode
// clair, globals.css force toute teinte `text-white*` à la couleur pleine.
function Skeleton() {
  const [kx, ky] = JOINTS.knee;
  return (
    <svg viewBox="0 0 200 260" role="img" aria-label="A body skeleton at the bottom of a squat, with the knee angle highlighted" className="h-56 w-auto sm:h-64">
      <g className="text-white opacity-40" stroke="currentColor" strokeWidth="5" strokeLinecap="round">
        {BONES.map(([from, to]) => (
          <line key={`${from}-${to}`} x1={JOINTS[from][0]} y1={JOINTS[from][1]} x2={JOINTS[to][0]} y2={JOINTS[to][1]} />
        ))}
      </g>
      <circle cx={JOINTS.head[0]} cy={JOINTS.head[1]} r="16" className="text-white opacity-40" fill="none" stroke="currentColor" strokeWidth="5" />
      {/* L'angle mesuré au genou, entre la cuisse et la jambe : c'est ce que le
          score compare au seuil de l'exercice. */}
      <path d={`M ${kx - 25} ${ky - 6} A 26 26 0 0 0 ${kx - 7} ${ky + 25}`} className="text-brandCP" fill="none" stroke="currentColor" strokeWidth="3" />
      <g className="text-brandCP" fill="currentColor">
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
      <div className="flex flex-col items-center gap-8 rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:flex-row sm:items-center sm:gap-10 sm:p-8">
        <Skeleton />
        <div className="flex w-full flex-col gap-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brandCP">On the phone</p>
          <ol className="flex flex-col gap-2.5">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brandCP/15 text-xs font-bold text-brandCP">
                  {index + 1}
                </span>
                <span className="text-sm leading-relaxed text-white/65">
                  <span className="font-semibold text-white">{step.title}</span> · {step.text}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-1 rounded-xl border border-dashed border-white/15 px-4 py-2.5 text-sm text-white/60">
            <span className="font-semibold text-white">Leaves the phone:</span> no image, no video.
          </p>
        </div>
      </div>
    </NewsFigure>
  );
}
