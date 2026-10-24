import type { Metadata } from "next";
import type { ReactNode } from "react";

import "@bebranded/elearning-react/styles.css";
import "survey-core/survey-core.min.css";
import "@bebranded/elearning-react/quiz.css";
import "./demo.css";

import { SourceLink } from "./_components/SourceLink";

export const metadata: Metadata = {
  title: "Acme Corp training (demo)",
  description: "A fictional host product for the BeBranded e-learning module.",
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="demo-header">
          <a href="/" className="demo-brand">
            Acme Corp training
          </a>
          <span className="demo-badge">Demo: fake sign-in, synthetic content</span>
          <a href="/admin">Back-office</a>
          <a href="/sign-in">Switch user</a>
          <SourceLink />
        </header>
        <main className="demo-main">{children}</main>
      </body>
    </html>
  );
}
