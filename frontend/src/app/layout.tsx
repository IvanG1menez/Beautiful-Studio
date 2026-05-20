import { FormEnterNavigation } from "@/components/FormEnterNavigation";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from '@/contexts/AuthContext';
import { QueryProvider } from "@/contexts/QueryProvider";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "Beautiful Studio - Gestión de Salón",
  description: "Sistema de gestión integral para salón de belleza",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <QueryProvider>
          <AuthProvider>
            <FormEnterNavigation>
              {children}
            </FormEnterNavigation>
            <Toaster />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
