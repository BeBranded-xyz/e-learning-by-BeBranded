import type { DropSide } from "./column-drop.js";

/**
 * The bar over the edge that would take a drop (spec 10). It lives outside
 * ProseMirror's DOM: a change there would re-render the blocks and the side
 * menu, whose drag handle would then cancel the drag.
 */
export class DropIndicator {
  private element: HTMLElement | null = null;

  /** Draws the bar along `side` of `target`; fixed, so it follows the viewport. */
  show(editorElement: HTMLElement, target: HTMLElement, side: DropSide): void {
    const bar = this.attach(editorElement);
    const rect = target.getBoundingClientRect();
    bar.dataset.side = side;
    bar.hidden = false;
    // Runtime geometry (allowed by the design rules): the target's measured position.
    bar.style.top = `${String(rect.top)}px`;
    bar.style.height = `${String(rect.height)}px`;
    bar.style.left = `${String(side === "left" ? rect.left : rect.right - 4)}px`;
  }

  hide(): void {
    if (this.element !== null) this.element.hidden = true;
  }

  destroy(): void {
    this.element?.remove();
    this.element = null;
  }

  /** Created on first use, inside the module's root, whose variables color it. */
  private attach(editorElement: HTMLElement): HTMLElement {
    if (this.element !== null) return this.element;
    const bar = editorElement.ownerDocument.createElement("div");
    bar.className = "el-column-drop-indicator";
    bar.setAttribute("aria-hidden", "true");
    (editorElement.closest(".el-root") ?? editorElement.ownerDocument.body).append(bar);
    this.element = bar;
    return bar;
  }
}
