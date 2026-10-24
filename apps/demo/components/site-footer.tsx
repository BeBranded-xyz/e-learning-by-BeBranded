import { Separator } from "@/components/ui/separator";

/** What the demo is, and where its design comes from. */
export function SiteFooter() {
  return (
    <footer className="mx-auto w-full max-w-6xl px-4 pb-10 text-sm text-muted-foreground">
      <Separator className="mb-6" />
      <p>
        Acme Corp is fictional. This demo runs e-learning by BeBranded (MIT) with its shadcn/ui
        theme; every color, font and radius comes from one file, <code>elearning.design.ts</code>.
      </p>
    </footer>
  );
}
