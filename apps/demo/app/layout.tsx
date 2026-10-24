import type { Metadata } from "next";
import type { ReactNode } from "react";

import "./layers.css";
import "@bebranded/elearning-react/styles.css";
import "survey-core/survey-core.min.css";
import "@bebranded/elearning-react/quiz.css";
import "./globals.css";

import { designToShadcnCss } from "@bebranded/elearning-core/design";

import { DemoFeedback } from "@/components/demo-feedback";
import { readEnv } from "@/lib/env";

import { DemoMain } from "@/components/demo-main";
import { DemoProvider } from "@/components/demo-context";
import { demoSession } from "@/lib/demo-session";
import { demoMessages } from "@/lib/demo-messages";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

import { design } from "../elearning.design";

export async function generateMetadata(): Promise<Metadata> {
  const messages = demoMessages((await demoSession()).locale);
  return { title: messages.title, description: messages.description };
}

export default async function RootLayout({ children }: { readonly children: ReactNode }) {
  const session = await demoSession();
  const messages = demoMessages(session.locale);
  return (
    <html lang={session.locale}>
      <head>
        {/* The design file's shadcn variables (spec 11); Tailwind and the shadcn kit read them. */}
        <style>{designToShadcnCss(design)}</style>
      </head>
      <body className="flex min-h-dvh flex-col">
        <SiteHeader {...session} messages={messages} />
        <DemoMain>
          <DemoProvider locale={session.locale} sessionKey={session.sessionKey}>
            {children}
          </DemoProvider>
        </DemoMain>
        <SiteFooter messages={messages} />
        <DemoFeedback widgetKey={readEnv().DEMO_DASHLY_WIDGET_KEY} />
      </body>
    </html>
  );
}
