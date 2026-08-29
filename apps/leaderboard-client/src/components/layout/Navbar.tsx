"use client";

import { Button } from "@/components/ui/Button";
import { ContributorBadge } from "@/components/contributor/ContributorBadge";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { MyTwinLogo } from "./MyTwinLogo";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

interface NavbarProps {
  session?: {
    fullName: string;
    githubUsername: string;
    role: string;
    avatarUrl?: string;
  } | null;
}

// Linear interpolation
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export const Navbar = ({ session }: NavbarProps) => {
  const [p, setP] = useState(0); // scroll progress 0→1
  // Home no longer has a distinctly-colored full-bleed hero to invert
  // against (see src/app/page.tsx) — default to false so there's no flash
  // of unreadable inverted nav text before the #hero-end observer (if any
  // page still renders that sentinel) has a chance to correct it.
  const [heroVisible, setHeroVisible] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLightMode, setIsLightMode] = useState(false);
  const pathname = usePathname();

  const isHomePage = pathname === "/";
  // Invert navbar colors while the hero section is visible (first ~260px of scroll)
  const invertNav = isHomePage && heroVisible;

  useEffect(() => {
    const handleScroll = () => setP(Math.min(window.scrollY / 72, 1));
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!isHomePage) {
      setHeroVisible(false);
      return;
    }
    const sentinel = document.getElementById("hero-end");
    if (!sentinel) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        // heroVisible = true as long as sentinel is in view or hasn't been reached yet
        setHeroVisible(entry.isIntersecting || entry.boundingClientRect.top > 0);
      },
      { threshold: 0 }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [isHomePage]);

  useEffect(() => {
    const check = () => setIsLightMode(document.documentElement.dataset.mode === "light");
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-mode"] });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "unset";
    return () => { document.body.style.overflow = "unset"; };
  }, [mobileMenuOpen]);

  const navLinks = [
    { name: "About", path: "/about" },
    { name: "Leaderboard", path: "/leaderboard" },
    { name: "Challenges", path: "/challenges" },
  ];

  const isActive = (path: string) => pathname === path || (path !== "/" && pathname.startsWith(path));

  return (
    <>
      {/*
        Two-layer approach:
        - Outer <nav>: always fixed inset-x-0, acts as a positioning container
        - Inner island <div>: carries the visual pill — bg, blur, radius, shadow
        By animating padding + border-radius on the island div, we achieve
        a smooth detach-from-edges effect without fighting CSS centering.
      */}
      <nav className="pointer-events-none fixed inset-x-0 top-0 z-50">
        {/* Island shell */}
        <div
          className="pointer-events-auto mx-auto"
          style={{
            maxWidth: "1152px", // matches max-w-6xl content below
            paddingLeft: `${lerp(0, 16, p)}px`,
            paddingRight: `${lerp(0, 16, p)}px`,
            paddingTop: `${lerp(0, 12, p)}px`,
          }}
        >
          <div
            style={{
              borderRadius: `${lerp(0, 999, p)}px`,
              backgroundColor: p > 0.05
                ? `color-mix(in srgb, var(--background) ${Math.round(lerp(0, 88, p))}%, transparent)`
                : undefined,
              backdropFilter: p > 0.05 ? `blur(${lerp(0, 10, p)}px) saturate(${lerp(100, 160, p)}%)` : undefined,
              WebkitBackdropFilter: p > 0.05 ? `blur(${lerp(0, 10, p)}px) saturate(${lerp(100, 160, p)}%)` : undefined,
              border: invertNav
                ? `1px solid rgba(0, 0, 0, ${lerp(0, 0.12, p)})`
                : `1px solid color-mix(in srgb, var(--foreground) ${lerp(0, 10, p).toFixed(0)}%, transparent)`,
              boxShadow: p > 0.05
                ? `0 ${lerp(0, 6, p)}px ${lerp(0, 28, p)}px rgba(0,0,0,${lerp(0, 0.55, p)})`
                : "none",
            }}
          >
            {/* Inner content row */}
            <div
              className="mx-auto flex max-w-6xl items-center justify-between"
              style={{
                paddingTop: `${lerp(16, 10, p)}px`,
                paddingBottom: `${lerp(16, 10, p)}px`,
                paddingLeft: `${lerp(24, 20, p)}px`,
                paddingRight: `${lerp(24, 20, p)}px`,
              }}
            >
              {/* Logo */}
              <Link href="/" className="z-50 flex items-center">
                <MyTwinLogo
                  className="h-8 w-auto sm:h-9"
                  style={{
                    color: invertNav ? "var(--background)" : undefined,
                    transition: "color 0.3s ease",
                  }}
                />
              </Link>

              {/* Desktop Navigation */}
              <div className="hidden flex-1 items-center justify-center md:flex mx-6">
                <div className="flex items-center space-x-8">
                  {navLinks.map((link) => (
                    <Link
                      key={link.path}
                      href={link.path}
                      className={cn(
                        "group relative pb-0.5 font-medium",
                        isActive(link.path)
                          ? "text-[15px]"
                          : "text-[13px] hover:text-brandCP hover:text-[15px]"
                      )}
                      style={{
                        color: invertNav
                          ? isActive(link.path)
                            ? "var(--background)"
                            : "color-mix(in srgb, var(--background) 60%, transparent)"
                          : isActive(link.path)
                            ? "var(--foreground)"
                            : "color-mix(in srgb, var(--foreground) 60%, transparent)",
                        transition: "font-size 300ms cubic-bezier(0.34, 1.56, 0.64, 1), color 0.3s ease",
                      }}
                    >
                      {link.name}
                      <span
                        className={cn(
                          "absolute -bottom-0.5 left-0 h-[2px] w-full origin-left rounded-full bg-brandCP transition-transform duration-200",
                          isActive(link.path) ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                        )}
                      />
                    </Link>
                  ))}
                </div>
              </div>

              {/* Desktop User Badge / Sign In */}
              <div className="hidden items-center md:flex">
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
                    className="flex items-center rounded-xl p-2 transition-colors"
                    style={{
                      background: invertNav
                        ? "rgba(0,0,0,0.08)"
                        : "color-mix(in srgb, var(--foreground) 10%, transparent)",
                    }}
                  >
                    <Image
                      src="/profile.svg"
                      alt="Sign in"
                      width={20}
                      height={20}
                      style={{
                        filter: invertNav
                          ? (isLightMode ? "none" : "invert(1)")
                          : (isLightMode ? "invert(1)" : undefined),
                        transition: "filter 0.3s ease",
                      }}
                    />
                  </Link>
                )}
              </div>

              {/* Mobile Menu Toggle */}
              <div className="md:hidden">
                <Button
                  variant="ghost"
                  size="md"
                  className="z-[60] p-2 hover:bg-transparent hover:text-current"
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                >
                  {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Fullscreen Menu */}
      <div
        className={cn(
          "fixed inset-0 z-40 md:hidden transition-all duration-500 ease-in-out",
          mobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      >
        <div
          className={cn(
            "absolute inset-0 backdrop-blur-2xl transition-opacity duration-500",
            mobileMenuOpen ? "opacity-95" : "opacity-0"
          )}
          style={{ background: "var(--background)" }}
        />

        <div className="relative h-full flex flex-col items-center justify-center px-8">
          <div className="flex flex-col items-center gap-8 mb-12">
            {navLinks.map((link, index) => (
              <Link
                key={link.path}
                href={link.path}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "text-3xl font-light tracking-tight transition-all duration-300 hover:text-brandCP",
                  isActive(link.path) ? "text-brandCP" : "text-white",
                  mobileMenuOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                )}
                style={{ transitionDelay: mobileMenuOpen ? `${index * 80 + 150}ms` : "0ms" }}
              >
                {link.name}
              </Link>
            ))}
          </div>

          <Link
            href={session ? "/contributors/me" : "/signin?from=/contributors/me"}
            onClick={() => setMobileMenuOpen(false)}
            className={cn(
              "text-3xl font-light tracking-tight transition-all duration-300 hover:text-brandCP text-white",
              mobileMenuOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            )}
            style={{ transitionDelay: mobileMenuOpen ? `${navLinks.length * 80 + 150}ms` : "0ms" }}
          >
            {session ? "Profile" : "Sign in"}
          </Link>
        </div>
      </div>
    </>
  );
};
