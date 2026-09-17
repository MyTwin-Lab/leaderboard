import { NewsFigure } from "@/components/news/NewsFigure";

// Les étapes reprennent les sections « How a contribution becomes CP » et
// « The Sandbox » : aucune règle qui n'y soit écrite.
const LOOP = [
  { title: "Pick a challenge", text: "A health need, a brief, published evaluation criteria." },
  { title: "Contribute", text: "Code, a dataset, a model or a verdict on a deliverable." },
  { title: "Get evaluated", text: "Against the challenge’s grid, with a human review on request." },
  { title: "Earn CP", text: "Credited to your profile and your place in the leaderboard." },
];

const SANDBOX = [
  { title: "Propose", text: "Launch your own project, no approval needed." },
  { title: "Get stars", text: "The community stars what it wants built." },
  { title: "Get promoted", text: "The most supported projects become challenges." },
];

function Step({ index, title, text }: { index: number; title: string; text: string }) {
  return (
    <li className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brandCP/15 text-xs font-bold text-brandCP">
        {index}
      </span>
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="text-sm leading-relaxed text-white/60">{text}</p>
    </li>
  );
}

export function ContributionLoop() {
  return (
    <NewsFigure caption="Two ways into the Lab: take on a challenge, or propose the project you want built.">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brandCP">Challenges</p>
          <ol className="grid gap-3 sm:grid-cols-4">
            {LOOP.map((step, index) => (
              <Step key={step.title} index={index + 1} {...step} />
            ))}
          </ol>
        </div>
        <div className="flex flex-col gap-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-brandCP">Sandbox</p>
          <ol className="grid gap-3 sm:grid-cols-3">
            {SANDBOX.map((step, index) => (
              <Step key={step.title} index={index + 1} {...step} />
            ))}
          </ol>
        </div>
      </div>
    </NewsFigure>
  );
}
