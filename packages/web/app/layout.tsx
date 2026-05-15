import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Mycel",
  description: "Mycel web",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
