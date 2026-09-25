import type { Metadata } from "next";

import { resolveSignInVariant } from "@/lib/signin";
import { safeInternalPath } from "@/lib/url";
import { MyTwinLogo } from "@/components/layout/MyTwinLogo";
import { vitrineFontVars } from "@/components/vitrine/fonts";

import "@/components/vitrine/vitrine.css";
import "./signin-vitrine.css";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Sign in with Google so your contributions can be tracked, evaluated and rewarded in CP.",
  // Une page de passage, jamais une destination de recherche.
  robots: { index: false, follow: false },
};

interface SignInPageProps {
  searchParams?: Promise<{ from?: string; reason?: string }>;
}

/** Google's "G" mark. Inlined rather than fetched — the page must render
 *  before any network round-trip, and this is the one brand mark on it. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
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

/**
 * `/signin`, d'après `Sign In Vitrine.dc.html`.
 *
 * Les deux variantes de texte restent celles de `lib/signin.ts` : la maquette
 * les recopie, elle ne les décide pas. `reason=account-updated` couvre la
 * session dont la ligne utilisateur a disparu (fusion ou suppression par un
 * admin).
 */
export default async function SignInPage({ searchParams }: SignInPageProps) {
  const resolved = searchParams ? await searchParams : {};
  const from = safeInternalPath(resolved.from);
  const variant = resolveSignInVariant(resolved.reason);

  const authorizeUrl = `/api/google-auth/authorize?from=${encodeURIComponent(from)}`;

  return (
    <div className={`vitrine v-signin ${vitrineFontVars}`}>
      {/* Le volet gauche est la page de garde, dans sa version téléphone :
          la même photo en portrait, le même voile clair, et le même bloc en
          haut à gauche — logo, promesse, accroche. Décoratif de bout en bout :
          le titre de la page est à droite, au-dessus du formulaire.

          Sur téléphone la feuille le sort entièrement — empilé au-dessus du
          formulaire, il repoussait le bouton sous la ligne de flottaison. */}
      <section className="v-signin-visual" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element -- image de fond plein cadre, pas de mise en page à réserver */}
        <img src="/home/enter-the-lab.jpg" alt="" className="v-signin-photo" />
        <div className="v-signin-veil" />

        <div className="v-signin-top">
          <MyTwinLogo className="v-signin-logo" />
          <p className="v-signin-claim">
            Building the world&rsquo;s most advanced human digital twin
          </p>
          <p className="v-signin-lede">
            Predictive, Preventive, Personalized and Proactive health
          </p>
        </div>
      </section>

      <section className="v-signin-form">
        <div className="v-signin-card">
          <div className="v-signin-head">
            <h1 className="v-signin-title">{variant.title}</h1>
            {variant.lines.map((line) => (
              <p key={line} className="v-signin-line">
                {line}
              </p>
            ))}
          </div>

          <div className="v-signin-actions">
            {/* Plain anchor, not next/link: the target is an API route that 302s
                to Google, so the client router must not try to handle it. */}
            <a href={authorizeUrl} className="v-signin-google">
              <GoogleMark />
              Continue with Google
            </a>

            {/* Les CGU font de la connexion le moment de leur acceptation : il
                faut donc qu'elles soient sous les yeux à cet instant précis. */}
            <p className="v-signin-legal">
              By continuing, you agree to the <a href="/terms-of-use">Terms of Use</a> and
              acknowledge the <a href="/privacy-policy">Privacy Policy</a>.
            </p>
          </div>

          <a href="/" className="v-signin-back">
            Back to home
          </a>
        </div>
      </section>
    </div>
  );
}
