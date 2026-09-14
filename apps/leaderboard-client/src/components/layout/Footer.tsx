import Link from "next/link";
import { MYTWIN } from "@/lib/seo";
import { MyTwinLogo } from "./MyTwinLogo";

const EXPLORE_LINKS = [
  { href: "/about", label: "About MyTwin Lab" },
  { href: "/challenges", label: "Challenges" },
  { href: "/sandbox", label: "Sandbox" },
  { href: "/leaderboard", label: "Leaderboard" },
];

// Le lien éditorial vers mytwin.care vit ici, sur toutes les pages : c'est lui
// qui dit, aux visiteurs comme aux moteurs, que le Lab appartient à MyTwin.
// Des <a> et non next/link : ce sont des pages d'un autre site.
const MYTWIN_LINKS = [
  { href: MYTWIN.home, label: "Discover MyTwin" },
  { href: MYTWIN.clinicians, label: "MyTwin for clinicians" },
  { href: MYTWIN.contact, label: "Contact" },
];

const LEGAL_LINKS = [
  { href: "/terms-of-use", label: "Terms of Use" },
  { href: "/privacy-policy", label: "Privacy Policy" },
];

const linkClass =
  "text-sm text-white/55 underline-offset-4 transition-colors hover:text-brandCP hover:underline";

function ColumnTitle({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/35">{children}</span>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-white/[0.07]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 sm:py-12">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          <div className="flex max-w-xs flex-col gap-3">
            <Link href="/" aria-label="MyTwin Lab home" className="w-fit">
              <MyTwinLogo className="h-8 w-auto" />
            </Link>
            <p className="text-sm leading-relaxed text-white/50">
              The open innovation lab of{" "}
              <a href={MYTWIN.home} className="font-medium text-white/80 underline-offset-4 hover:text-brandCP hover:underline">
                MyTwin
              </a>
              , where health challenges become working applications.
            </p>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-10 gap-y-8 sm:grid-cols-3">
            <div className="flex flex-col gap-2.5">
              <ColumnTitle>Explore</ColumnTitle>
              {EXPLORE_LINKS.map((link) => (
                <Link key={link.href} href={link.href} className={linkClass}>
                  {link.label}
                </Link>
              ))}
            </div>
            <div className="flex flex-col gap-2.5">
              <ColumnTitle>MyTwin</ColumnTitle>
              {MYTWIN_LINKS.map((link) => (
                <a key={link.href} href={link.href} className={linkClass}>
                  {link.label}
                </a>
              ))}
            </div>
            <div className="flex flex-col gap-2.5">
              <ColumnTitle>Legal</ColumnTitle>
              {LEGAL_LINKS.map((link) => (
                <Link key={link.href} href={link.href} className={linkClass}>
                  {link.label}
                </Link>
              ))}
            </div>
          </nav>
        </div>

        <div className="flex flex-col gap-2 border-t border-white/[0.07] pt-6 text-xs text-white/40 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} MyTwin Lab, a MyTwin initiative. All rights reserved.</span>
          <span className="font-semibold text-brandCP">#WeAreNotWaiting</span>
        </div>
      </div>
    </footer>
  );
}
