import Link from "next/link";
import { Markdown } from "@/components/ui/Markdown";
import { ArrowIcon } from "@/components/home/ArrowIcon";

/** La colonne de lecture des CGU et de la politique de confidentialité. */
export function LegalPage({ content, related }: { content: string; related: { href: string; label: string } }) {
  return (
    <article className="mx-auto max-w-3xl py-4 sm:py-8">
      <Markdown source={content} variant="prose" />
      <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6">
        <Link href="/" className="text-sm text-white/45 transition-colors hover:text-white/75">
          Back to home
        </Link>
        <Link
          href={related.href}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-brandCP transition-all duration-200 hover:gap-2"
        >
          {related.label}
          <ArrowIcon />
        </Link>
      </div>
    </article>
  );
}
