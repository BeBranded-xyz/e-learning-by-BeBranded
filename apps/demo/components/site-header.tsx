import { GraduationCap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { SourceLink } from "./source-link";

const NAVIGATION = [
  { href: "/", label: "Training" },
  { href: "/admin", label: "Back-office" },
  { href: "/sign-in", label: "Switch user" },
] as const;

/**
 * The fictional host's header: brand, navigation, and the module's source code.
 * Not sticky: a header over the page would cover the targets under it (WCAG 2.5.8).
 */
export function SiteHeader({ brand }: { readonly brand: string }) {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <a href="/" className="flex min-h-11 items-center gap-2 font-semibold tracking-tight">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <GraduationCap className="size-5" aria-hidden="true" />
          </span>
          {brand}
        </a>
        <Badge variant="secondary">Demo: fake sign-in, synthetic content</Badge>
        {/* On a narrow screen the ghost buttons' padding would indent the links: pull them back in line. */}
        <nav aria-label="Main" className="-ms-3 flex flex-wrap items-center gap-1 sm:ms-0">
          {NAVIGATION.map((item) => (
            <Button key={item.href} asChild variant="ghost" size="sm">
              <a href={item.href}>{item.label}</a>
            </Button>
          ))}
        </nav>
        <div className="sm:ms-auto">
          <SourceLink />
        </div>
      </div>
    </header>
  );
}
