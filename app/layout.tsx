import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/contexts/AppContext";
import { Sidebar } from "@/components/Sidebar";
import { strategyConfigs } from "@/lib/constants";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tasty Trade",
  description: "Options trading strategies",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AppProvider>
          <div className="flex bg-white font-sans text-black dark:bg-black dark:text-white">
            <Sidebar strategies={strategyConfigs} />
            <main className="flex-1 pt-14 lg:ml-64 lg:pt-0">{children}</main>
          </div>
        </AppProvider>
      </body>
    </html>
  );
}
