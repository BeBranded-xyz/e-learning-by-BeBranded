import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./layers.css";
import "@bebranded/elearning-react/styles.css";
import "survey-core/survey-core.min.css";
import "@bebranded/elearning-react/quiz.css";
import "./globals.css";

import { designToShadcnCss } from "@bebranded/elearning-core/design";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

import { design } from "../elearning.design";

export const metadata: Metadata = {
  title: "Acme Corp training (demo)",
  description: "A fictional host product for the BeBranded e-learning module.",
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* The design file's shadcn variables (spec 11); Tailwind and the shadcn kit read them. */}
        <style>{designToShadcnCss(design)}</style>
      </head>
      <body className="flex min-h-dvh flex-col">
        <SiteHeader brand={design.brand.name} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
