import { NewsFigure } from "@/components/news/NewsFigure";

// Une mammographie stylisée : le contour d'un sein en vue craniocaudale, et une
// zone plus dense. Illustratif, ce n'est pas une image médicale.
//
// Le cliché reste sur son noir, au milieu de la page claire : c'est ce que
// montre une mammographie, et la maquette le garde tel quel.
const FILM = "#11161a";
const ACCENT = "#3FA1AA";

function Breast({ children }: { children?: React.ReactNode }) {
  return (
    <svg viewBox="0 0 160 160" aria-hidden>
      <rect width="160" height="160" fill={FILM} />
      <path d="M 18 12 C 120 18 150 70 150 80 C 150 90 120 142 18 148 Z" fill="rgb(255 255 255 / 0.15)" />
      <path d="M 18 30 C 90 36 124 70 126 80 C 124 90 90 124 18 130 Z" fill="rgb(255 255 255 / 0.1)" />
      <ellipse cx="92" cy="70" rx="13" ry="10" fill="rgb(255 255 255 / 0.45)" />
      {children}
    </svg>
  );
}

export function ThatAndWhere() {
  return (
    <NewsFigure caption="The two challenges answer complementary questions about the same image.">
      <div className="v-nd-tiles" data-wide="true">
        <div className="v-nd-tile" data-media="true">
          <Breast>
            <rect x="96" y="120" width="54" height="24" rx="12" fill={ACCENT} />
            <text x="123" y="136" textAnchor="middle" fontSize="12" fontWeight="700" fill={FILM}>
              ?
            </text>
          </Breast>
          <div className="v-nd-tile-body">
            <span className="v-nd-tile-label" data-accent="true">
              Classification
            </span>
            <span className="v-nd-tile-title" data-lead="true">
              Is something suspicious?
            </span>
            <span className="v-nd-tile-text">Normal, benign or malignant. Scored on AUC.</span>
          </div>
        </div>

        <div className="v-nd-tile" data-media="true">
          <Breast>
            <ellipse cx="92" cy="70" rx="19" ry="16" fill="none" stroke={ACCENT} strokeWidth="3" strokeDasharray="5 4" />
          </Breast>
          <div className="v-nd-tile-body">
            <span className="v-nd-tile-label" data-accent="true">
              Segmentation
            </span>
            <span className="v-nd-tile-title" data-lead="true">
              Where exactly?
            </span>
            <span className="v-nd-tile-text">A pixel-level mask of the lesion. Scored on Dice and IoU.</span>
          </div>
        </div>
      </div>
    </NewsFigure>
  );
}
