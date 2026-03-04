import type { HTMLAttributes, PropsWithChildren } from "react";

export function Card({ children, className = "", ...props }: PropsWithChildren<HTMLAttributes<HTMLElement>>): JSX.Element {
  return (
    <section {...props} className={`card ${className}`.trim()}>
      {children}
    </section>
  );
}
