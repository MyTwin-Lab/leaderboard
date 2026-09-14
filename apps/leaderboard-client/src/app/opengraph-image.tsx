import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/seo";

/**
 * L'image d'aperçu des liens partagés (Slack, LinkedIn, X...), pour toutes les
 * pages. Générée au build : elle ne lit rien en base, donc la couleur est celle
 * du thème par défaut (`brandCP` de lib/themes.ts), pas celle réglée par l'admin.
 */
export const alt = `${SITE_NAME} - together, we're building the most advanced digital twin of the human body`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BRAND = "#0af7c1";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "linear-gradient(135deg, #05070d 0%, #0b1a24 60%, #06302a 100%)",
          color: "#ffffff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 48, height: 4, borderRadius: 2, background: BRAND }} />
          <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: 6, color: BRAND }}>
            #WEARENOTWAITING
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", fontSize: 66, fontWeight: 700, lineHeight: 1.1 }}>
          <span style={{ color: BRAND }}>Together,</span>
          <span>we’re building the world’s most advanced digital twin of the human body.</span>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 30, color: "rgba(255,255,255,0.6)" }}>
          <span>{SITE_NAME}</span>
          <span>Contribute. Get evaluated. Earn CP.</span>
        </div>
      </div>
    ),
    size,
  );
}
