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
      <div className="v-nd-tiles" data-wide="true">
        <div className="v-nd-tile" data-dashed="true">
          <span className="v-nd-tile-label">At a glance</span>
          <span className="v-nd-tile-title" data-lead="true">
            Straight to what you came for
          </span>
          <ul className="v-nd-rows">
            {SCREEN.map((item) => (
              <li key={item.label} className="v-nd-row" data-on={item.target}>
                {item.label}
              </li>
            ))}
          </ul>
        </div>

        <div className="v-nd-tile">
          <span className="v-nd-tile-label" data-accent="true">
            With a screen reader
          </span>
          <span className="v-nd-tile-title" data-lead="true">
            One element after another
          </span>
          <ol className="v-nd-rows">
            {SCREEN.map((item, index) => (
              <li key={item.label} className="v-nd-row" data-on={item.target} data-dim={index > TARGET}>
                <span className="v-nd-step-num" data-small="true">
                  {index + 1}
                </span>
                <span className="v-nd-row-role">{item.role}</span>
                {item.label}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </NewsFigure>
  );
}
