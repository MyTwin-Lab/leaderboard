import type { NewsFaqItem } from "@/content/news/types";

/**
 * `<details>` natif : pas de JS, et les réponses repliées restent dans le DOM
 * — ce qui est balisé doit être réellement présent dans la page.
 */
export function NewsFaq({ id, items }: { id: string; items: NewsFaqItem[] }) {
  return (
    <section aria-labelledby={id} className="v-nd-faq">
      <h2 id={id} className="v-nd-faq-title">
        Frequently asked questions
      </h2>

      <div className="v-nd-faq-list">
        {items.map((item) => (
          <details key={item.question} className="v-nd-faq-item">
            <summary className="v-nd-faq-summary">
              <h3 className="v-nd-faq-q">{item.question}</h3>
              <span aria-hidden className="v-nd-badge">
                +
              </span>
            </summary>
            <p className="v-nd-faq-a">{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
