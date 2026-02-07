"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "destructive";

const CLASS_BY_VARIANT: Record<Variant, string> = {
  primary: "button-primary",
  secondary: "button-secondary",
  ghost: "button-ghost",
  destructive: "button-danger",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  loading?: boolean;
  loadingText?: string;
  children: ReactNode;
};

export function Button({
  variant = "primary",
  loading = false,
  loadingText = "Working...",
  disabled,
  children,
  ...rest
}: Props) {
  return (
    <button className={CLASS_BY_VARIANT[variant]} disabled={disabled || loading} {...rest}>
      {loading ? loadingText : children}
    </button>
  );
}
