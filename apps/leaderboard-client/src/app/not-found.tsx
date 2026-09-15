import Link from "next/link";

/**
 * Le 404 du site. Sert en particulier aux pages de challenge et de sandbox dont
 * le slug ne désigne rien : elles répondent un vrai 404 (`notFound()`), plus
 * un 200 marqué `noindex` qu'un moteur aurait classé en « soft 404 ».
 */
export default function NotFound() {
  return (
    <div className="mx-auto mt-8 max-w-lg space-y-4 rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-white sm:p-7">
      <h1 className="text-xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-sm leading-relaxed text-white/60">
        This page doesn&apos;t exist, or it has moved. The challenges and the community projects are one click away.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link
          href="/challenges"
          className="rounded-full bg-brandCP/20 px-4 py-2 text-[13px] font-semibold text-brandCP transition-colors hover:bg-brandCP/30"
        >
          Browse the challenges
        </Link>
        <Link
          href="/sandbox"
          className="rounded-full border border-white/10 px-4 py-2 text-[13px] font-semibold text-white/70 transition-colors hover:border-white/20 hover:text-white"
        >
          Open the sandbox
        </Link>
      </div>
    </div>
  );
}
