import { NewsFigure } from "@/components/news/NewsFigure";

// Une mammographie stylisée : le contour d'un sein en vue craniocaudale, et une
// zone plus dense. Illustratif, ce n'est pas une image médicale.
function Breast({ children }: { children?: React.ReactNode }) {
  return (
    <svg viewBox="0 0 160 160" aria-hidden className="h-36 w-36">
      <rect width="160" height="160" rx="16" className="fill-black" />
      <path d="M 18 12 C 120 18 150 70 150 80 C 150 90 120 142 18 148 Z" className="fill-white/15" />
      <path d="M 18 30 C 90 36 124 70 126 80 C 124 90 90 124 18 130 Z" className="fill-white/10" />
      <ellipse cx="92" cy="70" rx="13" ry="10" className="fill-white/45" />
      {children}
    </svg>
  );
}

export function ThatAndWhere() {
  return (
    <NewsFigure caption="The two challenges answer complementary questions about the same image.">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center">
          <Breast>
            <rect x="96" y="120" width="54" height="24" rx="12" className="fill-brandCP" />
            <text x="123" y="136" textAnchor="middle" className="fill-black text-[11px] font-bold">
              ?
            </text>
          </Breast>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brandCP">Classification</p>
            <p className="mt-2 text-base font-semibold text-white">Is something suspicious?</p>
            <p className="mt-1 text-sm text-white/60">Normal, benign or malignant. Scored on AUC.</p>
          </div>
        </div>
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center">
          <Breast>
            <ellipse cx="92" cy="70" rx="19" ry="16" fill="none" strokeWidth="3" strokeDasharray="5 4" className="stroke-brandCP" />
          </Breast>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brandCP">Segmentation</p>
            <p className="mt-2 text-base font-semibold text-white">Where exactly?</p>
            <p className="mt-1 text-sm text-white/60">A pixel-level mask of the lesion. Scored on Dice and IoU.</p>
          </div>
        </div>
      </div>
    </NewsFigure>
  );
}
