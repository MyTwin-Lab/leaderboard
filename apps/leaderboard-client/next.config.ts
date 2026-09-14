import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Config turbopack vide pour permettre l'utilisation de --webpack
  turbopack: {},

  // Ni l'API ni les pages privées n'ont rien à faire dans un index. Un en-tête
  // plutôt qu'un Disallow dans robots.txt, pour que le moteur puisse le lire :
  // voir app/robots.ts. Il couvre aussi les pages client (`/tasks`,
  // `/sync-meetings`, `/admin`), qui ne peuvent pas exporter de métadonnées.
  async headers() {
    const noindex = [{ key: "X-Robots-Tag", value: "noindex, nofollow" }];
    // En-têtes de sécurité, sur toutes les routes. La CSP se limite
    // volontairement à `frame-ancestors` (anti-clickjacking) : une politique
    // script-src casserait les scripts inline de Next sans nonce.
    const security = [
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
    ];
    return [
      { source: "/:path*", headers: security },
      ...[
        "/api/:path*",
        "/admin/:path*",
        "/signin",
        "/contributors/me",
        "/challenges/:id/manage",
        "/tasks/:path*",
        "/sync-meetings/:path*",
      ].map((source) => ({ source, headers: noindex })),
    ];
  },

  // Configuration webpack pour résoudre les imports du monorepo
  webpack: (config, { isServer }) => {
    // Résoudre les alias pour les packages
    config.resolve.alias = {
      ...config.resolve.alias,
      '@packages/config': path.resolve(__dirname, '../../packages/config'),
      '@packages/database-service': path.resolve(__dirname, '../../packages/database-service'),
      '@packages/services': path.resolve(__dirname, '../../packages/services'),
      '@packages/connectors': path.resolve(__dirname, '../../packages/connectors'),
    };
    
    // Permettre l'import de fichiers .js depuis les packages
    config.resolve.extensionAlias = {
      '.js': ['.js', '.ts'],
      '.mjs': ['.mjs', '.mts'],
    };
    
    return config;
  },
};

export default nextConfig;
