import type { Metadata } from "next";
import { resolveSignInVariant } from "@/lib/signin";
import { safeInternalPath } from "@/lib/url";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in with Google so your contributions can be tracked, evaluated and rewarded in CP.",
};

interface SignInPageProps {
  searchParams?: Promise<{ from?: string; reason?: string }>;
}

/** Google's "G" mark. Inlined rather than fetched — the page must render
 *  before any network round-trip, and this is the one brand mark on it. */
function GoogleMark() {
  return (
    <svg className="h-[18px] w-[18px] shrink-0" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <path
        fill="#FBBC05"
        d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34C2.85 16.09 2 19.95 2 24s.85 7.91 2.34 11.18l7.35-5.7z"
      />
      <path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.82l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </svg>
  );
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const resolved = searchParams ? await searchParams : {};
  const from = safeInternalPath(resolved.from);
  const variant = resolveSignInVariant(resolved.reason);

  const authorizeUrl = `/api/google-auth/authorize?from=${encodeURIComponent(from)}`;

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-12">
      <div className="animate-fade-up w-full max-w-md motion-reduce:animate-none">
        <div className="flex flex-col gap-6 rounded-2xl border border-white/10 bg-white/[0.02] p-7 sm:p-9">
          {/* Eyebrow — same rule-and-label device as the home hero, so this
              reads as part of the product rather than a stock OAuth screen. */}
          <div className="flex items-center gap-3">
            <span className="h-[2px] w-8 rounded-full bg-brandCP" />
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-brandCP">
              {variant.eyebrow}
            </span>
          </div>

          <div className="flex flex-col gap-3">
            <h1 className="text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl">
              {variant.title}
            </h1>
            {variant.lines.map((line, index) => (
              <p
                key={line}
                className={
                  index === 0
                    ? "text-sm leading-relaxed text-white/70 sm:text-base"
                    : "text-xs leading-relaxed text-white/45 sm:text-sm"
                }
              >
                {line}
              </p>
            ))}
          </div>

          {/* Plain anchor, not next/link: the target is an API route that 302s
              to Google, so the client router must not try to handle it. */}
          <a
            href={authorizeUrl}
            className="inline-flex w-full items-center justify-center gap-2.5 rounded-xl bg-brandCP/20 px-6 py-3 text-sm font-semibold text-brandCP transition-all duration-200 hover:bg-brandCP/30 hover:shadow-[0_0_16px_rgba(10,247,193,0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brandCP/40"
          >
            <GoogleMark />
            Continue with Google
          </a>
        </div>

        <div className="mt-5 text-center">
          <a
            href="/"
            className="rounded text-xs text-white/40 transition-colors hover:text-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brandCP/40"
          >
            Back to home
          </a>
        </div>
      </div>
    </div>
  );
}
