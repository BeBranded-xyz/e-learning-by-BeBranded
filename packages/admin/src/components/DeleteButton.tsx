"use client";

import { useState } from "react";

import { useUi } from "@bebranded/elearning-react";

import { useAdmin } from "../provider/admin-context.js";

export type DeleteButtonProps = {
  /** What is deleted, for the confirmation and the button's accessible name. */
  readonly title: string;
  readonly onConfirm: () => void;
  readonly disabled?: boolean;
};

/** Deleting asks once, inline: no browser dialog, keyboard friendly. */
export function DeleteButton({ title, onConfirm, disabled = false }: DeleteButtonProps) {
  const { t } = useAdmin();
  const { Button } = useUi();
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <Button
        disabled={disabled}
        aria-label={`${t.t("action.delete")}: ${title}`}
        onClick={() => {
          setConfirming(true);
        }}
      >
        {t.t("action.delete")}
      </Button>
    );
  }
  return (
    <span
      className="el-admin-confirm"
      role="group"
      aria-label={t.t("action.deleteConfirm", { title })}
    >
      <span>{t.t("action.deleteConfirm", { title })}</span>
      <Button
        variant="destructive"
        onClick={() => {
          setConfirming(false);
          onConfirm();
        }}
      >
        {t.t("action.delete")}
      </Button>
      <Button
        onClick={() => {
          setConfirming(false);
        }}
      >
        {t.t("action.cancel")}
      </Button>
    </span>
  );
}
