import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FinPro Elite",
  description: "Gestão Financeira Inteligente",
  manifest: "/manifest.json",
  icons: {
    apple: "/icon-192x192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-br">
      {/* ADICIONE O suppressHydrationWarning AQUI: */}
      <body suppressHydrationWarning={true}>
        {children}
      </body>
    </html>
  );
}