import type { NewsFaqItem } from "@/content/news/types";

/**
 * `<details>` natif : pas de JS, et les réponses repliées restent dans le DOM
 * — ce qui est balisé doit être réellement présent dans la page.
 */
export function NewsFaq({ id, items }: { id: string; items: NewsFaqItem[] }) {
  return (
    <section aria-labelledby={id} className="mt-14 sm:mt-16">
      <h2 id={id} className="scroll-mt-24 text-2xl font-bold tracking-tight text-white sm:text-3xl">
        Frequently asked questions
      </h2>

      <div className="mt-6 border-t border-white/10">
        {items.map((item) => (
          <details key={item.question} className="group border-b border-white/10">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 [&::-webkit-details-marker]:hidden">
              <h3 className="text-base font-semibold leading-snug tracking-tight text-white sm:text-lg">
                {item.question}
              </h3>
              <span
                aria-hidden
                className="text-xl leading-none text-brandCP transition-transform duration-200 group-open:rotate-45"
              >
                +
              </span>
            </summary>
            <p className="pb-6 text-pretty text-[15px] leading-[1.75] text-white/65 sm:text-base">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
