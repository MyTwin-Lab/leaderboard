import { NewsFigure } from "@/components/news/NewsFigure";

// Une onde vocale stylisée : des barres de hauteurs variées, illustratives.
const BARS = [12, 28, 44, 30, 58, 72, 40, 22, 50, 66, 80, 54, 34, 18, 26, 48, 62, 38, 20, 10, 24, 46, 70, 52, 30, 16];

// Les deux colonnes reprennent la section « What a voice carries » : ce que
// l'analyse regarde, et ce qu'elle ignore.
const ANALYSED = ["Pitch, and how it varies", "Pace and pauses", "Voice quality", "Rhythm"];

export function VoiceSignal() {
  return (
    <NewsFigure caption="About thirty seconds of speech: the analysis looks at how you speak, not at what you say.">
      <div className="flex flex-col gap-5 rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8">
        <div aria-hidden className="flex h-24 items-center justify-center gap-1.5">
          {BARS.map((height, index) => (
            <span key={index} className="w-1.5 rounded-full bg-brandCP" style={{ height: `${height}%`, opacity: 0.45 + height / 180 }} />
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-brandCP/40 bg-brandCP/[0.07] p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brandCP">How you speak · analysed</p>
            <ul className="mt-3 flex flex-col gap-1.5 text-sm text-white/65">
              {ANALYSED.map((item) => (
                <li key={item}>✓ {item}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-4">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">What you say · not analysed</p>
            <p className="mt-3 text-sm leading-relaxed text-white/60">
              The meaning of your words plays no part in the result.
            </p>
          </div>
        </div>
      </div>
    </NewsFigure>
  );
}
