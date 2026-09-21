import Image from "next/image";
import Link from "next/link";

export function LandingFooter() {
  return (
    <footer className="l-footer">
      <div className="l-container l-footer__inner">
        <Image src="/landing/logo/mytwin-lab-logo-light.png" alt="MyTwin Lab" width={644} height={246} className="l-footer__logo" />
        <nav aria-label="Legal">
          <Link href="/terms-of-use">Terms of use</Link>
          <Link href="/privacy-policy">Privacy policy</Link>
        </nav>
      </div>
    </footer>
  );
}
