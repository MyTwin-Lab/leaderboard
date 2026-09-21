import Link from "next/link";

import { MyTwinLogo } from "@/components/layout/MyTwinLogo";

export function LandingFooter() {
  return (
    <footer className="l-footer">
      <div className="l-container l-footer__inner">
        <MyTwinLogo />
        <nav aria-label="Legal">
          <Link href="/terms-of-use">Terms of use</Link>
          <Link href="/privacy-policy">Privacy policy</Link>
        </nav>
      </div>
    </footer>
  );
}
