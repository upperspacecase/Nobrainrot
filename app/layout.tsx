import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wireheading Audit — Tools to get you offline",
  description:
    "Upload a screen recording of scrolling through your iOS apps. Get back a ranked kill list of apps using slot-machine mechanics, with reasons.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
