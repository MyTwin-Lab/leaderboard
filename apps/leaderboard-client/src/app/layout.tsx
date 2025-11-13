import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { GradientBackground } from "@/components/layout/GradientBackground";
import { AppHeader } from "@/components/layout/AppHeader";
import { ContentContainer } from "@/components/layout/ContentContainer";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MyTwin Leaderboard",
  description: "Visualisez le classement des contributeurs du Lab",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <GradientBackground>
          <AppHeader />
          <ContentContainer>{children}</ContentContainer>
        </GradientBackground>
      </body>
    </html>
  );
}
