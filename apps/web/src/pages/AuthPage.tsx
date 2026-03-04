import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card } from "../components/common/Card";
import { Button } from "../components/common/Button";
import { isEmail } from "../utils/validation";
import { signIn, signInWithGoogle, signUp } from "../auth/authService";
import { useUi } from "../app/providers";
import { acceptInvite } from "../services/householdApi";
import { debugBadge } from "../dev/uiDebug";

export function AuthPage(): JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const oauthError = searchParams.get("oauth_error");
  const { pushToast } = useUi();

  useEffect(() => {
    if (!oauthError) return;
    pushToast(oauthError);
    navigate("/auth", { replace: true });
  }, [navigate, oauthError, pushToast]);

  async function maybeAcceptInvite(): Promise<void> {
    if (!inviteToken) return;
    await acceptInvite({ token: inviteToken });
  }

  return (
    <div className="app page stack" data-ui="page-auth">
      {debugBadge("AuthPage", "src/pages/AuthPage.tsx")}
      <Card data-ui="auth-signin-card">
        <h1 style={{ margin: 0 }}>Cuvver</h1>
        <p style={{ marginTop: "6px" }}>You&apos;re covered.</p>
        <hr className="hr" />
        <img src="/cuvverapp_logo.png" alt="Cuvver logo" className="brand-logo" />
        <form
          className="stack"
          data-ui="auth-signin-form"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const email = (form.elements.namedItem("email") as HTMLInputElement).value.trim().toLowerCase();
            const password = (form.elements.namedItem("password") as HTMLInputElement).value;

            if (!isEmail(email) || !password) {
              pushToast("Enter a valid email and password.");
              return;
            }

            try {
              await signIn(email, password);
              await maybeAcceptInvite();
              navigate("/bootstrap", { replace: true });
            } catch (error) {
              pushToast(error instanceof Error ? error.message : "Sign in failed.");
            }
          }}
        >
          <h2 className="section-title">Sign in</h2>
          <div className="form-row">
            <label htmlFor="signin-email">Email</label>
            <input id="signin-email" className="input" name="email" type="email" required />
          </div>
          <div className="form-row">
            <label htmlFor="signin-password">Password</label>
            <input id="signin-password" className="input" name="password" type="password" required />
          </div>
          <Button type="submit">Sign in</Button>
        </form>
        <Button
          variant="ghost"
          data-ui="auth-signin-google-button"
          onClick={async () => {
            try {
              await signInWithGoogle();
            } catch (error) {
              pushToast(error instanceof Error ? error.message : "Google sign-in failed.");
            }
          }}
        >
          Continue with Google
        </Button>
      </Card>

      <Card data-ui="auth-signup-card">
        <form
          className="stack"
          data-ui="auth-signup-form"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const displayName = (form.elements.namedItem("display_name") as HTMLInputElement).value.trim();
            const email = (form.elements.namedItem("email") as HTMLInputElement).value.trim().toLowerCase();
            const password = (form.elements.namedItem("password") as HTMLInputElement).value;

            if (!displayName || !isEmail(email) || password.length < 8) {
              pushToast("Use a valid email and an 8+ character password.");
              return;
            }

            try {
              await signUp(displayName, email, password);
              await signIn(email, password);
              await maybeAcceptInvite();
              navigate("/bootstrap", { replace: true });
            } catch (error) {
              pushToast(error instanceof Error ? error.message : "Signup failed.");
            }
          }}
        >
          <h2 className="section-title">Create account</h2>
          <div className="form-row">
            <label htmlFor="signup-display-name">Display name</label>
            <input id="signup-display-name" className="input" name="display_name" required />
          </div>
          <div className="form-row">
            <label htmlFor="signup-email">Email</label>
            <input id="signup-email" className="input" name="email" type="email" required />
          </div>
          <div className="form-row">
            <label htmlFor="signup-password">Password</label>
            <input id="signup-password" className="input" name="password" type="password" minLength={8} required />
          </div>
          <Button type="submit" variant="secondary">
            Create account
          </Button>
        </form>
        <Button
          variant="ghost"
          data-ui="auth-signup-google-button"
          onClick={async () => {
            try {
              await signInWithGoogle();
            } catch (error) {
              pushToast(error instanceof Error ? error.message : "Google sign-up failed.");
            }
          }}
        >
          Sign up with Google
        </Button>
      </Card>
    </div>
  );
}
