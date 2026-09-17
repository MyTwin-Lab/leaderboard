import { NewsFigure } from "@/components/news/NewsFigure";

// Les trois temps de la section « How a camera sees your pulse ». L'onde est
// une forme de pouls générique, pas une mesure.
const STAGES = [
  { title: "Light on the skin", text: "Room light and the screen reflect off the forehead." },
  { title: "Tiny colour changes", text: "Each heartbeat changes the blood under the skin, and the light it reflects." },
  { title: "The pulse wave", text: "Rebuilt from the video, then turned into measurements." },
];

// Un battement stylisé : montée rapide, pic, onde dicrote, retour.
const BEAT = "l 10 0 l 8 -46 l 8 40 l 6 -10 l 8 14 l 20 2";

export function CameraPulse() {
  return (
    <NewsFigure caption="Remote photoplethysmography: the principle of a finger pulse oximeter, with light reflected by the face.">
      <div className="flex flex-col gap-6 rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
        <svg viewBox="0 0 360 80" aria-hidden className="h-20 w-full">
          <path
            d={`M 0 60 ${BEAT} ${BEAT} ${BEAT} ${BEAT} ${BEAT} ${BEAT}`}
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="stroke-brandCP"
          />
        </svg>
        <ol className="grid gap-3 sm:grid-cols-3">
          {STAGES.map((stage, index) => (
            <li key={stage.title} className="flex flex-col gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brandCP/15 text-xs font-bold text-brandCP">
                {index + 1}
              </span>
              <p className="text-sm font-semibold text-white">{stage.title}</p>
              <p className="text-sm leading-relaxed text-white/60">{stage.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </NewsFigure>
  );
}
