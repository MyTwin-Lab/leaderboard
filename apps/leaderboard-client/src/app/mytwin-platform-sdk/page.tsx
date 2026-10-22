import Link from "next/link";
import { Blocks, Database, Network, Puzzle, ShieldCheck, type LucideIcon } from "lucide-react";

import { ArrowRightIcon } from "@/components/marketplace/icons";
import { BackToLab } from "@/components/vitrine/BackToLab";
import { vitrineFontVars } from "@/components/vitrine/fonts";
import { MARKETPLACE_PATH, PLATFORM_SDK_PATH } from "@/lib/paths";
import { unlistedMetadata } from "@/lib/seo";

import "@/components/vitrine/vitrine.css";
import "@/components/marketplace/marketplace-vitrine.css";

// Ouverte à son URL, hors des index et du sitemap (docs/marketplace.md).
export const metadata = unlistedMetadata({
  title: "MyTwin Platform SDK",
  description:
    "Integrate once. Access the MyTwin ecosystem: a future lightweight, unified developer interface for health data, intelligent modules and partner integrations.",
  path: PLATFORM_SDK_PATH,
});

const SIMPLIFIES: { icon: LucideIcon; text: string }[] = [
  { icon: Blocks, text: "Access to modular health capabilities" },
  { icon: Network, text: "Integration with multiple technology partners" },
  { icon: ShieldCheck, text: "Standardization of health data" },
  { icon: Database, text: "Compatibility with the MyTwin Data Hub" },
  { icon: Puzzle, text: "Integration of health intelligence into third-party applications" },
];

/**
 * `/mytwin-platform-sdk` — la vision d'une interface développeur unifiée.
 *
 * Une intention, pas un produit : aucun paquet à installer, aucun exemple de
 * code, aucune authentification. Le statut « Coming soon » le dit, et le seul
 * appel mène aux modules qui existent déjà, au catalogue.
 */
export default function PlatformSdkPage() {
  return (
    <div className={`vitrine v-mk ${vitrineFontVars}`}>
      <div className="v-main v-sdk">
        <header className="v-sdk-hero">
          <BackToLab />
          <div className="v-sdk-tags">
            <span className="v-eyebrow">
              <span className="v-eyebrow-dot" aria-hidden="true" />
              MyTwin Platform SDK
            </span>
            <span className="v-mk-status">Coming soon</span>
          </div>
          <h1 className="v-title v-sdk-title">Integrate once. Access the MyTwin ecosystem.</h1>
          <p className="v-lede">
            A lightweight, unified developer interface for health data, intelligent modules and partner integrations.
          </p>
          <p className="v-lede">
            Build personalized health applications with reusable capabilities designed to work together across the
            MyTwin Platform.
          </p>
          <Link href={MARKETPLACE_PATH} className="v-sdk-cta">
            Explore MyTwin modules
            <ArrowRightIcon />
          </Link>
        </header>

        <section className="v-sdk-why" aria-labelledby="sdk-why">
          <div className="v-sdk-why-text">
            <h2 id="sdk-why" className="v-mk-section-title">
              Why one interface
            </h2>
            <p>
              Developers should not have to manage a different integration architecture for every partner. MyTwin will
              progressively provide a shared developer interface over its internal modules and partner integrations.
            </p>
          </div>

          <ul className="v-sdk-list" aria-label="What the SDK will simplify">
            {SIMPLIFIES.map(({ icon: Icon, text }) => (
              <li key={text}>
                <span className="v-mk-icon" data-quiet="true">
                  <Icon strokeWidth={1.6} aria-hidden="true" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
