import React, { StrictMode, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";

const AuthApp = lazy(() => import("./auth-app.jsx"));

const rootEl = document.getElementById("hudi-auth-root");

function normalizePrivyDevOrigin() {
  if (!import.meta.env.DEV) return false;
  if (window.location.hostname !== "127.0.0.1") return false;

  const nextUrl = new URL(window.location.href);
  nextUrl.hostname = "localhost";
  window.location.replace(nextUrl.href);
  return true;
}

if (rootEl && !normalizePrivyDevOrigin()) {
  createRoot(rootEl).render(
    <StrictMode>
      <Suspense fallback={null}>
        <AuthApp />
      </Suspense>
    </StrictMode>
  );
}
