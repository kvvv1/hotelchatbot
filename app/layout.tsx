import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { PWARegister } from "@/components/PWARegister";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const viewport: Viewport = {
  themeColor: '#7c3aed',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export const metadata: Metadata = {
  title: "HotelTalk - Sistema de IA e Gestao Hoteleira",
  description: "Agente, atendimento e gestao hoteleira em um so sistema",
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icon?v=2',
    shortcut: '/icon?v=2',
    apple: '/apple-icon?v=2',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'HotelTalk',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.className} antialiased`}>
        <PWARegister />
        {children}
      </body>
    </html>
  );
}
