import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Utiliser webpack au lieu de Turbopack pour compatibilité monorepo
  // Turbopack ne supporte pas bien les imports relatifs complexes
  experimental: {
    // Forcer webpack
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
