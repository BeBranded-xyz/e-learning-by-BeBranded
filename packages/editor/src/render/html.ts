/** Escapes text and attribute values: every user string goes through here. */
export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

type AttributeValue = string | number | boolean | undefined;

/** ` name="value"` pairs; `false` and `undefined` are omitted, `true` gives a bare attribute. */
function attributes(values: Record<string, AttributeValue>): string {
  return Object.entries(values)
    .filter(([, value]) => value !== undefined && value !== false)
    .map(([name, value]) =>
      value === true ? ` ${name}` : ` ${name}="${escapeHtml(String(value))}"`,
    )
    .join("");
}

export function element(tag: string, attrs: Record<string, AttributeValue>, inner: string): string {
  return `<${tag}${attributes(attrs)}>${inner}</${tag}>`;
}
