import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/manrope/400.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "@fontsource/manrope/800.css";
import "@fontsource/noto-sans-arabic/400.css";
import "@fontsource/noto-sans-arabic/600.css";
import type { Metadata } from "next";
import "./globals.css";
import "./brand-tokens.css";
import { connection } from "next/server";
export const metadata: Metadata = {
  icons: {
    icon: [
      { url: "/brand/favicon-32.png?v=3", sizes: "32x32", type: "image/png" },
      { url: "/brand/favicon-16.png?v=3", sizes: "16x16", type: "image/png" },
    ],
    apple: {
      url: "/brand/apple-touch-icon.png?v=3",
      sizes: "180x180",
      type: "image/png",
    },
  },
  title: "EduBest · L’espace de notre école",
  description:
    "L’espace EduBest pour les élèves, les familles et l’équipe : cours, présences, documents et paiements. Français et arabe.",
};
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection();
  return (
    <html lang="fr" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
