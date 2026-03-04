import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

export function Button({ variant = "primary", className = "", ...props }: Props): JSX.Element {
  return <button {...props} className={`btn ${variant} ${className}`.trim()} />;
}
