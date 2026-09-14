import { LegalPage } from "@/components/legal/LegalPage";
import { getLegalDocument } from "@/lib/server/legal";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Terms of Use",
  description:
    "MyTwin Lab terms of use: research and prototyping only, health data rules, contributions and intellectual property, contribution points and your commitments.",
  path: "/terms-of-use",
});

export default function TermsOfUsePage() {
  return (
    <LegalPage
      content={getLegalDocument("terms-of-use")}
      related={{ href: "/privacy-policy", label: "Privacy Policy" }}
    />
  );
}
