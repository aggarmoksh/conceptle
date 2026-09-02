import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Conceptle",
  description: "A daily semantic-guessing puzzle.",
};

// No custom fonts per Phase 2 scope: the system font stack is declared once in
// globals.css and inherited everywhere.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Requirement 9: no-JS fallback. This renders even if the client
            bundle never executes. */}
        <noscript>
          <div
            style={{
              padding: "2rem",
              textAlign: "center",
              fontFamily: "system-ui, -apple-system, sans-serif",
            }}
          >
            Conceptle requires JavaScript.
          </div>
        </noscript>
        {children}
      </body>
    </html>
  );
}
