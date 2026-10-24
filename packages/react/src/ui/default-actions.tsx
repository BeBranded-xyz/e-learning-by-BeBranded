import type { ButtonSize, ButtonVariant, UiButtonProps, UiLinkButtonProps } from "./kit.types.js";

const VARIANT_CLASSES: Readonly<Record<ButtonVariant, string>> = {
  primary: " el-button-primary",
  secondary: "",
  destructive: " el-button-danger",
  ghost: " el-button-ghost",
};

const buttonClass = (variant: ButtonVariant = "secondary", size: ButtonSize = "md") =>
  `el-button${VARIANT_CLASSES[variant]}${size === "sm" ? " el-button-sm" : ""}`;

export function DefaultButton({ variant, size, type = "button", ...button }: UiButtonProps) {
  // `type` is always set: a default button inside a form would submit it.
  return <button {...button} type={type} className={buttonClass(variant, size)} />;
}

export function DefaultLinkButton({ variant, size, children, ...link }: UiLinkButtonProps) {
  return (
    <a {...link} className={buttonClass(variant, size)}>
      {children}
    </a>
  );
}
