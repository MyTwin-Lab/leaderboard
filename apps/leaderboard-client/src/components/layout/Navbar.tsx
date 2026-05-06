"use client";

import { Button } from "@/components/ui/Button";
import { ContributorBadge } from "@/components/contributor/ContributorBadge";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

interface NavbarProps {
  session?: {
    fullName: string;
    githubUsername: string;
    role: string;
  } | null;
}

export const Navbar = ({ session }: NavbarProps) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [mobileMenuOpen]);

  const navLinks = [
    { name: "About", path: "/about" },
    { name: "Leaderboard", path: "/" },
    { name: "Challenges", path: "/challenges" },
  ];

  const isActive = (path: string) => {
    if (path === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(path);
  };

  return (
    <>
      <nav
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out",
          isScrolled
            ? "bg-backgroundDark/20 backdrop-blur-md border-b border-white/10"
            : "bg-transparent"
        )}
      >
        <div className="mx-auto w-full max-w-6xl flex items-center justify-between px-4 py-4 sm:px-6">
          {/* Logo */}
          <Link href="/" className="z-50 flex items-center">
            <Image
              src="/mytwinlab.svg"
              alt="MyTwinLab"
              width={154}
              height={62}
              priority
              className="h-8 w-auto sm:h-9"
            />
            <span className="sr-only">MyTwinLab</span>
          </Link>

          {/* Desktop Navigation - Centered */}
          <div className="hidden md:flex items-center justify-center flex-1 mx-8">
            <div className="flex items-center space-x-12">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  href={link.path}
                  className={cn(
                    "text-xl font-medium transition-colors hover:text-brandCP",
                    isActive(link.path) ? "text-brandCP" : "text-white/70"
                  )}
                >
                  {link.name}
                </Link>
              ))}
            </div>
          </div>

          {/* Desktop User Badge / Sign In */}
          <div className="hidden md:flex items-center">
            {session ? (
              <ContributorBadge fullName={session.fullName} githubUsername={session.githubUsername} role={session.role} />
            ) : (
              <div className="hidden p-2 md:flex items-center rounded-2xl bg-white/10 hover:bg-white/15 cursor-pointer transition">
                <Link href="/api/google-auth/authorize?from=/contributors/me" className="transition hover:opacity-80">
                  <Image src="/profile.svg" alt="Sign in" width={24} height={24} />
                </Link>
              </div>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="md"
              className="z-[60] hover:bg-transparent hover:text-current p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
              <span className="sr-only">Toggle menu</span>
            </Button>
          </div>
        </div>
      </nav>

      {/* Mobile Fullscreen Menu */}
      <div
        className={cn(
          "fixed inset-0 z-40 md:hidden transition-all duration-500 ease-in-out",
          mobileMenuOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        )}
      >
        {/* Background with blur */}
        <div
          className={cn(
            "absolute inset-0 bg-backgroundDark backdrop-blur-2xl transition-opacity duration-500",
            mobileMenuOpen ? "opacity-100" : "opacity-0"
          )}
        />

        {/* Menu Content */}
        <div className="relative h-full flex flex-col items-center justify-center px-8">
          {/* Navigation Links */}
          <div className="flex flex-col items-center gap-8 mb-12">
            {navLinks.map((link, index) => (
              <Link
                key={link.path}
                href={link.path}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "text-3xl font-light tracking-tight transition-all duration-300 hover:text-brandCP",
                  isActive(link.path) ? "text-brandCP" : "text-white",
                  mobileMenuOpen
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-4"
                )}
                style={{
                  transitionDelay: mobileMenuOpen ? `${index * 100 + 200}ms` : "0ms",
                }}
              >
                {link.name}
              </Link>
            ))}
          </div>

          {/* Mobile User Profile / Sign In */}
          <Link
            href={session ? "/contributors/me" : "/api/google-auth/authorize?from=/contributors/me"}
            onClick={() => setMobileMenuOpen(false)}
            className={cn(
              "text-3xl font-light tracking-tight transition-all duration-300 hover:text-brandCP",
              session ? "text-white" : "text-white",
              mobileMenuOpen
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-4"
            )}
            style={{
              transitionDelay: mobileMenuOpen ? `${navLinks.length * 100 + 200}ms` : "0ms",
            }}
          >
            {session ? "Profile" : "Sign in"}
          </Link>
        </div>
      </div>
    </>
  );
};
