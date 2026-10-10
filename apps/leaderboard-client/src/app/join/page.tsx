import type { Metadata } from "next";

import { JoinForm } from "@/components/join/JoinForm";
import { BackToLab } from "@/components/vitrine/BackToLab";
import { vitrineFontVars } from "@/components/vitrine/fonts";
import { JOIN_PATH } from "@/lib/join";
import { pageMetadata } from "@/lib/seo";

import "@/components/vitrine/vitrine.css";
import "@/components/booking/booking-vitrine.css";
import "@/components/join/join-vitrine.css";

// Une page de conversion, comme `/book` : hors de l'index, liens suivis.
export const metadata: Metadata = {
  ...pageMetadata({
    title: "Join the Lab",
    description: "Join the MyTwin Lab community and follow how the human digital twin is built.",
    path: JOIN_PATH,
  }),
  robots: { index: false, follow: true },
};

/**
 * `/join` — « Join the Lab », au style vitrine : le titre et la carte du
 * formulaire de `/book`, seuls, en une colonne centrée.
 *
 * Un e-mail suffit ; le compte n'est demandé qu'au moment de participer à un
 * challenge.
 */
export default function JoinPage() {
  return (
    <div className={`vitrine v-book v-join ${vitrineFontVars}`}>
      <div className="v-main">
        <BackToLab />

        <div className="v-join-solo">
          <h1 className="v-title v-join-solo-title">Join the Lab</h1>
          <JoinForm />
        </div>
      </div>
    </div>
  );
}
