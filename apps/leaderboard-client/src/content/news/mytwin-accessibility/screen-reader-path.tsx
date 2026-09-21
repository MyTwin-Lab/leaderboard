import { NewsFigure } from "@/components/news/NewsFigure";

// Le paragraphe « Designing with your eyes closed », en image : un même écran,
// vu d'un coup d'œil et lu élément par élément. L'écran est un exemple, pas une
// capture de MyTwin.
const SCREEN = [
  { role: "Heading", label: "My health" },
  { role: "Button", label: "Add a measurement" },
  { role: "Menu", label: "Records" },
  { role: "Link", label: "Blood test results", target: true },
  { role: "Button", label: "Share with my doctor" },
];

const TARGET = SCREEN.findIndex((item) => item.target);

export function ScreenReaderPath() {
  return (
    <NewsFigure caption="The same screen, taken in at a glance, and read aloud one element at a time.">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/45">At a glance</p>
          <p className="text-base font-semibold text-white">Straight to what you came for</p>
          <ul className="flex flex-col gap-2 text-sm">
            {SCREEN.map((item) => (
              <li
                key={item.label}
                className={
                  item.target
                    ? "rounded-lg border border-brandCP/40 bg-brandCP/[0.07] px-3 py-2 font-semibold text-brandCP"
                    : "rounded-lg border border-white/10 px-3 py-2 text-white/45"
                }
              >
                {item.label}
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brandCP">With a screen reader</p>
          <p className="text-base font-semibold text-white">One element after another</p>
          <ol className="flex flex-col gap-2 text-sm">
            {SCREEN.map((item, index) => (
              <li
                key={item.label}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                  item.target ? "border border-brandCP/40 bg-brandCP/[0.07]" : "border border-white/10"
                } ${index > TARGET ? "opacity-40" : ""}`}
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brandCP/15 text-[11px] font-bold text-brandCP">
                  {index + 1}
                </span>
                <span className="w-14 shrink-0 text-xs text-white/45">{item.role}</span>
                <span className={item.target ? "font-semibold text-brandCP" : "text-white/70"}>{item.label}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </NewsFigure>
  );
}
