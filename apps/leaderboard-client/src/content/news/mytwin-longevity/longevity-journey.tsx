import { CalendarCheck, ClipboardList, Droplet, RefreshCw, type LucideIcon } from "lucide-react";
import { NewsFigure } from "@/components/news/NewsFigure";

type Step = {
  icon: LucideIcon;
  label: string;
  title: string;
  text: string;
};

// Les quatre étapes de l'app, nommées comme elle les nomme, chacune résumée par
// une phrase de la section « A four-step journey ».
const STEPS: Step[] = [
  {
    icon: Droplet,
    label: "Step 1",
    title: "Start my health check-up",
    text: "A blood check-up feeds the twin; biological age appears once it is done.",
  },
  {
    icon: CalendarCheck,
    label: "Step 2",
    title: "Meet my longevity doctor",
    text: "At least 30 minutes with a doctor specialised in prevention and longevity.",
  },
  {
    icon: ClipboardList,
    label: "Step 3",
    title: "Get my personalised plan",
    text: "A plan built from the results and the consultation.",
  },
  {
    icon: RefreshCw,
    label: "Then",
    title: "Track my progress",
    text: "New tests update the twin, and the journey starts again.",
  },
];

export function LongevityJourney() {
  return (
    <NewsFigure caption="The MyTwin Longevity journey, as the app lays it out.">
      <ol className="v-nd-tiles">
        {STEPS.map(({ icon: Icon, label, title, text }, index) => (
          <li key={title} className="v-nd-tile" data-on={index === 0}>
            <span className="v-nd-tile-label">
              <Icon aria-hidden className="h-4 w-4" />
              {label}
            </span>
            <span className="v-nd-tile-title" data-lead="true">
              {title}
            </span>
            <span className="v-nd-tile-text">{text}</span>
          </li>
        ))}
      </ol>
    </NewsFigure>
  );
}
