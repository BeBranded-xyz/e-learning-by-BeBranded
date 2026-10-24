import { Button } from "@/components/ui/button";
import type { DemoLocale, DemoMessages } from "@/lib/demo-messages";
import type { DemoPersona } from "@/lib/demo-users";

import { DemoSwitchers } from "./demo-switchers";
import { SourceLink } from "./source-link";

/** A compact demo toolbar; controls wrap below the brand on narrow screens. */
export function SiteHeader({
  persona,
  locale,
  messages,
}: {
  readonly persona: DemoPersona | null;
  readonly locale: DemoLocale;
  readonly messages: DemoMessages;
}) {
  return (
    <header className="demo-site-header border-b bg-background text-sm">
      <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
        <a href="/" className="inline-flex min-h-8 items-center font-semibold tracking-tight">
          {messages.title}
        </a>
        <div className="order-last flex w-full flex-wrap items-center gap-2 md:order-none md:w-auto">
          <nav aria-label={messages.navigation} className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm">
              <a href="/">{messages.training}</a>
            </Button>
            {persona === "admin" ? (
              <Button asChild variant="ghost" size="sm">
                <a href="/admin">{messages.admin}</a>
              </Button>
            ) : null}
          </nav>
          <DemoSwitchers persona={persona} locale={locale} messages={messages} />
        </div>
        <div className="ms-auto flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <a
              href="https://www.bebranded.xyz/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label={messages.brand}
            >
              BeBranded
            </a>
          </Button>
          <SourceLink label={messages.github} />
        </div>
      </div>
    </header>
  );
}
