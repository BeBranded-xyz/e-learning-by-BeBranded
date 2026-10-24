import type { DemoMessages } from "@/lib/demo-messages";
import { Separator } from "@/components/ui/separator";

export function SiteFooter({ messages }: { readonly messages: DemoMessages }) {
  return (
    <footer className="mx-auto w-full max-w-6xl px-4 pb-6 text-sm text-muted-foreground">
      <Separator className="mb-4" />
      <div className="grid gap-2">
        <p>{messages.footer}</p>
        <p>
          {messages.videoCredit}{" "}
          <a className="underline underline-offset-4" href="https://peach.blender.org/about/">
            Big Buck Bunny
          </a>
          {" · "}
          <a
            className="underline underline-offset-4"
            href="https://creativecommons.org/licenses/by/3.0/"
          >
            {messages.license}
          </a>
        </p>
      </div>
    </footer>
  );
}
