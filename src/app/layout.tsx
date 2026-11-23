import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TravelCompanion: trip itinerary and budget planner",
  description: "Plan your trip day by day and keep your travel budget on track. A friendlier alternative to a spreadsheet.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
