"use client";

import type { DragEvent, ReactNode } from "react";

export type DropZoneProps = {
  readonly enabled: boolean;
  /** Whether the zone itself can be dragged (a lesson), or only receives drops (a chapter). */
  readonly draggable?: boolean;
  readonly onDragStart?: () => void;
  readonly onDrop: () => void;
  readonly children: ReactNode;
};

/**
 * Pointer drag and drop for reordering. It is an enhancement only: the move
 * buttons give the same result with a keyboard or a screen reader (WCAG
 * 2.5.7), so the zone itself is not focusable and has no role.
 */
export function DropZone({
  enabled,
  draggable = false,
  onDragStart,
  onDrop,
  children,
}: DropZoneProps) {
  const over = (event: DragEvent) => {
    event.preventDefault();
  };
  return (
    // eslint-disable-next-line jsx-a11y-x/no-static-element-interactions -- pointer-only enhancement; the move buttons are the accessible path (BACKLOG B-057)
    <div
      className="el-admin-drop"
      draggable={enabled && draggable}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", "lesson");
        onDragStart?.();
      }}
      onDragOver={enabled ? over : undefined}
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (enabled) onDrop();
      }}
    >
      {children}
    </div>
  );
}
