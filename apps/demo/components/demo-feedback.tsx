import Script from "next/script";

/** Demo-only help launcher; the public embed identifier is supplied by the host. */
export function DemoFeedback({ widgetKey }: { readonly widgetKey?: string }) {
  if (widgetKey === undefined) return null;
  return (
    <Script
      id="demo-feedback-widget"
      src="https://app.usedashly.com/widget/v1.js"
      data-key={widgetKey}
      strategy="afterInteractive"
      async
    />
  );
}
