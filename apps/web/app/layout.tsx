import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Cluvvi",
    template: "%s · Cluvvi",
  },
  description: "Find who needs what you sell—and inspect the evidence behind every result.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppHeader />
        {children}
      </body>
    </html>
  );
}
