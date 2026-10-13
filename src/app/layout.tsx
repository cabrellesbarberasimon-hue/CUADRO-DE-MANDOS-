import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";

const montserrat = Montserrat({ subsets: ["latin"], weight: ["300", "400", "500", "600"], variable: "--font-montserrat" });

export const metadata: Metadata = {
  title: "Cuadro de Mandos · Bocubi",
  description: "Control semanal de gestión de Bocubi",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={montserrat.variable}>
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
