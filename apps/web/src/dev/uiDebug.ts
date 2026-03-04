import { createElement, type CSSProperties, type ReactNode } from "react";

export const UI_DEBUG = String(import.meta.env.VITE_UI_DEBUG ?? "").toLowerCase() === "true";

const badgeStyle: CSSProperties = {
  position: "absolute",
  top: "8px",
  right: "8px",
  zIndex: 40,
  pointerEvents: "none"
};

export function debugBadge(name: string, path: string): ReactNode {
  if (!UI_DEBUG) return null;

  return createElement(
    "span",
    {
      className: "ui-debug-badge",
      "aria-hidden": true,
      style: badgeStyle
    },
    `${name} - ${path}`
  );
}
