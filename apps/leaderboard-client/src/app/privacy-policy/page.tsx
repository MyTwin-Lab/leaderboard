import { LegalPage } from "@/components/legal/LegalPage";
import { getLegalDocument } from "@/lib/server/legal";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Privacy Policy",
  description:
    "How MyTwin Lab collects, uses and protects your personal data: what is public, AI evaluation of contributions, service providers, cookies and your GDPR rights.",
  path: "/privacy-policy",
});

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      content={getLegalDocument("privacy-policy")}
      related={{ href: "/terms-of-use", label: "Terms of Use" }}
    />
  );
}
