import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PuzzleShare — Rent & Lend Puzzles",
  description:
    "A peer-to-peer and warehouse marketplace for jigsaw puzzles (and, soon, board & card games).",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
