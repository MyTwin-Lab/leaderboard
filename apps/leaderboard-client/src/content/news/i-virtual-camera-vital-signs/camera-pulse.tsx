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
      <div className="v-nd-panel">
        <svg viewBox="0 0 360 80" aria-hidden className="h-20 w-full">
          <path
            d={`M 0 60 ${BEAT} ${BEAT} ${BEAT} ${BEAT} ${BEAT} ${BEAT}`}
            fill="none"
            stroke="#3FA1AA"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <ol className="v-nd-tiles">
          {STAGES.map((stage, index) => (
            <li key={stage.title} className="v-nd-tile" data-bare="true">
              <span className="v-nd-step-num">{index + 1}</span>
              <span className="v-nd-tile-title">{stage.title}</span>
              <span className="v-nd-tile-text">{stage.text}</span>
            </li>
          ))}
        </ol>
      </div>
    </NewsFigure>
  );
}
