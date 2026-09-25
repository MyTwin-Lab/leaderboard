import { NewsFigure } from "@/components/news/NewsFigure";

// Une onde vocale stylisée : des barres de hauteurs variées, illustratives.
const BARS = [12, 28, 44, 30, 58, 72, 40, 22, 50, 66, 80, 54, 34, 18, 26, 48, 62, 38, 20, 10, 24, 46, 70, 52, 30, 16];

// Les deux colonnes reprennent la section « What a voice carries » : ce que
// l'analyse regarde, et ce qu'elle ignore.
const ANALYSED = ["Pitch, and how it varies", "Pace and pauses", "Voice quality", "Rhythm"];

export function VoiceSignal() {
  return (
    <NewsFigure caption="About thirty seconds of speech: the analysis looks at how you speak, not at what you say.">
      <div className="v-nd-panel">
        <div aria-hidden className="flex h-24 items-center justify-center gap-1.5">
          {BARS.map((height, index) => (
            <span
              key={index}
              className="w-1.5 rounded-full bg-[#3FA1AA]"
              style={{ height: `${height}%`, opacity: 0.45 + height / 180 }}
            />
          ))}
        </div>
        <div className="v-nd-tiles" data-wide="true">
          <div className="v-nd-tile" data-on="true">
            <span className="v-nd-tile-label">How you speak · analysed</span>
            <ul className="v-nd-tile-list">
              {ANALYSED.map((item) => (
                <li key={item}>
                  <span aria-hidden>✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="v-nd-tile" data-dashed="true">
            <span className="v-nd-tile-label">What you say · not analysed</span>
            <span className="v-nd-tile-text">The meaning of your words plays no part in the result.</span>
          </div>
        </div>
      </div>
    </NewsFigure>
  );
}
