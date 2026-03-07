import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  mode: "signin" | "signup";
};

function GoogleIcon(): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.29h6.45a5.52 5.52 0 0 1-2.4 3.63v3h3.88c2.26-2.08 3.56-5.15 3.56-8.65z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.88-3c-1.07.72-2.44 1.14-4.05 1.14-3.11 0-5.74-2.1-6.68-4.92h-4V17.4A11.99 11.99 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.32 14.31A7.21 7.21 0 0 1 4.95 12c0-.8.14-1.57.37-2.31V6.6h-4A11.99 11.99 0 0 0 0 12c0 1.93.46 3.76 1.32 5.4l4-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.6 4.58 1.78l3.44-3.44C17.94 1.16 15.23 0 12 0 7.31 0 3.26 2.69 1.32 6.6l4 3.09c.94-2.82 3.57-4.92 6.68-4.92z"
      />
    </svg>
  );
}

export function GoogleAuthButton({ mode, className = "", ...props }: Props): JSX.Element {
  const label = mode === "signup" ? "Sign up with Google" : "Sign in with Google";

  return (
    <button
      type="button"
      {...props}
      className={`google-auth-btn ${className}`.trim()}
      aria-label={label}
    >
      <span className="google-auth-icon" aria-hidden="true">
        <GoogleIcon />
      </span>
      <span>{label}</span>
    </button>
  );
}
