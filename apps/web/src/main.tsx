import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App";
import { Providers } from "./app/providers";
import { supabase } from "./lib/supabaseClient";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";

async function normalizeOauthHash(): Promise<void> {
  const hash = window.location.hash;
  if (!hash.startsWith("#") || hash.startsWith("#/")) return;

  const params = new URLSearchParams(hash.slice(1));
  if (params.get("error")) {
    const message =
      params.get("error_description") ??
      params.get("error_code") ??
      params.get("error") ??
      "Unable to complete Google sign-in.";
    window.location.hash = `#/auth?oauth_error=${encodeURIComponent(message)}`;
    return;
  }

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) return;

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken
  });
  if (error) {
    window.location.hash = `#/auth?oauth_error=${encodeURIComponent(error.message)}`;
    return;
  }

  window.location.hash = "#/bootstrap";
}

async function start(): Promise<void> {
  await normalizeOauthHash();

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <Providers>
        <App />
      </Providers>
    </React.StrictMode>
  );
}

void start();
