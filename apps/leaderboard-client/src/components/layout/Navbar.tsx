"use client";

import { ContributorBadge } from "@/components/contributor/ContributorBadge";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { MyTwinLogo } from "./MyTwinLogo";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { vitrineHeading } from "@/components/vitrine/fonts";
import { HOME_GATE_OPEN_EVENT } from "@/components/home/HomeGate";
import { isVitrineRoute } from "./LabShell";

import "./navbar.css";

interface NavbarProps {
  session?: {
    fullName: string;
    githubUsername: string;
    role: string;
    avatarUrl?: string;
  } | null;
}

// Pas de « Home » : c'est le logo, à gauche, qui y mène.
const NAV_LINKS = [
  { name: "Leaderboard", path: "/leaderboard" },
  { name: "Challenges", path: "/challenges" },
  { name: "Sandbox", path: "/sandbox" },
];

/** Le défilement au-delà duquel la barre se détache en îlot. */
const SCROLL_THRESHOLD = 8;

export const Navbar = ({ session }: NavbarProps) => {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const isHomePage = pathname === "/";
  const isActive = (path: string) => pathname === path || pathname.startsWith(`${path}/`);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > SCROLL_THRESHOLD);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Une navigation referme le menu mobile.
  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <>
      <header
        className={cn("lab-nav", vitrineHeading.className)}
        data-surface={isVitrineRoute(pathname) ? "vitrine" : "app"}
        data-scrolled={scrolled ? "true" : "false"}
        data-open={menuOpen ? "true" : "false"}
      >
        {/* Le menu mobile : une page plein écran, derrière la barre. La barre
            ne bouge pas — seul le burger devient une croix. */}
        <div id="lab-nav-menu" className="lab-nav-menu" inert={!menuOpen}>
          <ul>
            {NAV_LINKS.map((link, index) => (
              <li key={link.path} style={{ "--i": index } as React.CSSProperties}>
                <Link
                  href={link.path}
                  className="lab-nav-menu-link"
                  aria-current={isActive(link.path) ? "page" : undefined}
                  onClick={() => setMenuOpen(false)}
                >
                  {link.name}
                </Link>
              </li>
            ))}
            <li className="lab-nav-menu-account" style={{ "--i": NAV_LINKS.length } as React.CSSProperties}>
              <Link
                href={session ? "/contributors/me" : "/signin?from=/contributors/me"}
                className="lab-nav-menu-link"
                onClick={() => setMenuOpen(false)}
              >
                {session ? "Profile" : "Sign in"}
              </Link>
            </li>
          </ul>
        </div>

        <div className="lab-nav-island">
          <div className="lab-nav-row">
            {/* Déjà sur l'accueil, le lien ne mènerait nulle part : il rouvre
                la prépage à la place. */}
            <Link
              href="/"
              className="lab-nav-logo"
              aria-label="MyTwin Lab — home"
              onClick={(event) => {
                if (!isHomePage) return;
                event.preventDefault();
                setMenuOpen(false);
                window.dispatchEvent(new Event(HOME_GATE_OPEN_EVENT));
              }}
            >
              <MyTwinLogo className="h-7 w-auto sm:h-8" />
            </Link>

            <nav aria-label="Main" className="lab-nav-links">
              <ul>
                {NAV_LINKS.map((link) => (
                  <li key={link.path}>
                    <Link
                      href={link.path}
                      className="lab-nav-link"
                      aria-current={isActive(link.path) ? "page" : undefined}
                    >
                      <span className="lab-nav-link-label">
                        {link.name}
                        {/* La copie colorée que le balayage révèle. Cachée aux
                            lecteurs d'écran : le mot est déjà là, au-dessus. */}
                        <span className="lab-nav-link-fill" aria-hidden="true">
                          {link.name}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="lab-nav-actions">
              {session ? (
                <ContributorBadge
                  fullName={session.fullName}
                  githubUsername={session.githubUsername}
                  role={session.role}
                  avatarUrl={session.avatarUrl}
                />
              ) : (
                <Link
                  href="/signin?from=/contributors/me"
                  className="lab-nav-cta"
                  aria-label="Sign in"
                  title="Sign in"
                >
                  {/* La silhouette de /profile.svg, en ligne pour qu'elle prenne
                      la couleur du texte au lieu d'un filtre par thème. */}
                  <svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">
                    <path d="M2 28C2 24.6863 4.68629 22 8 22H32C35.3137 22 38 24.6863 38 28H2Z" />
                    <rect x="11" width="18" height="18" rx="9" />
                    <path d="M38 28C38 29.5759 37.5344 31.1363 36.6298 32.5922C35.7253 34.0481 34.3994 35.371 32.7279 36.4853C31.0565 37.5996 29.0722 38.4835 26.8883 39.0865C24.7044 39.6896 22.3638 40 20 40C17.6362 40 15.2956 39.6896 13.1117 39.0865C10.9278 38.4835 8.94353 37.5996 7.27208 36.4853C5.60062 35.371 4.27475 34.0481 3.37017 32.5922C2.46558 31.1363 2 29.5759 2 28H20H38Z" />
                  </svg>
                </Link>
              )}
            </div>

            <button
              type="button"
              className="lab-nav-burger"
              aria-expanded={menuOpen}
              aria-controls="lab-nav-menu"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span />
              <span />
            </button>
          </div>

        </div>
      </header>

    </>
  );
};
