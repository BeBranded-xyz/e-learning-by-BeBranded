"use client";

import { useState } from "react";

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
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button
        type="button"
        className="el-button"
        disabled={disabled}
        aria-label={`${t.t("action.delete")}: ${title}`}
        onClick={() => {
          setConfirming(true);
        }}
      >
        {t.t("action.delete")}
      </button>
    );
  }
  return (
    <span
      className="el-admin-confirm"
      role="group"
      aria-label={t.t("action.deleteConfirm", { title })}
    >
      <span>{t.t("action.deleteConfirm", { title })}</span>
      <button
        type="button"
        className="el-button el-button-danger"
        onClick={() => {
          setConfirming(false);
          onConfirm();
        }}
      >
        {t.t("action.delete")}
      </button>
      <button
        type="button"
        className="el-button"
        onClick={() => {
          setConfirming(false);
        }}
      >
        {t.t("action.cancel")}
      </button>
    </span>
  );
}
