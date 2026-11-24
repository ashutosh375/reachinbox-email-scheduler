
import { useEffect, useState } from "react";
import { googleLogout } from "@react-oauth/google";

import Dashboard from "./pages/dashboard";
import Compose from "./pages/Compose";
import Login from "./pages/Login";

import { verifyGoogleLogin } from "./services/authApi";
import type { AuthUser } from "./services/authApi";

function App() {
  const [user, setUser] = useState<AuthUser | null>(null);

  const [currentPage, setCurrentPage] = useState<
    "dashboard" | "compose"
  >("dashboard");

  const [loginError, setLoginError] = useState("");
  const [isCheckingSession, setIsCheckingSession] =
    useState(true);

  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Restore existing Redis session after page refresh
  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      try {
        const response = await fetch("/api/auth/me", {
          credentials: "same-origin",
        });

        if (!response.ok) {
          if (response.status === 401) {
            return;
          }

          throw new Error("Failed to restore login session");
        }

        const data: { user: AuthUser } =
          await response.json();

        if (!cancelled) {
          setUser(data.user);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Session check failed:", error);
          setLoginError(
            "Unable to check your login session. Please try again."
          );
        }
      } finally {
        if (!cancelled) {
          setIsCheckingSession(false);
        }
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  // Google Login
  async function handleGoogleLogin(credential: string) {
    if (isLoggingIn) return;

    try {
      setIsLoggingIn(true);
      setLoginError("");

      const verifiedUser =
        await verifyGoogleLogin(credential);

      setUser(verifiedUser);
      setCurrentPage("dashboard");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Login failed";

      setLoginError(message);
    } finally {
      setIsLoggingIn(false);
    }
  }

  // Logout from backend Redis session
  async function handleLogout() {
    if (isLoggingOut) return;

    try {
      setIsLoggingOut(true);
      setLoginError("");

      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });

      if (!response.ok) {
        throw new Error("Logout failed. Please try again.");
      }

      googleLogout();

      setUser(null);
      setCurrentPage("dashboard");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Logout failed";

      setLoginError(message);
    } finally {
      setIsLoggingOut(false);
    }
  }

  // Show loading screen while checking session
  if (isCheckingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#00ad49]" />

          <p className="text-sm text-gray-500">
            Checking your session...
          </p>
        </div>
      </div>
    );
  }

  // Login Page
  if (!user) {
    return (
      <>
        <Login
          onLogin={(credential) => {
            void handleGoogleLogin(credential);
          }}
        />

        {isLoggingIn && (
          <div className="fixed inset-0 z-30 flex items-center justify-center bg-white/70">
            <div className="text-center">
              <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#00ad49]" />

              <p className="text-sm text-gray-600">
                Signing you in...
              </p>
            </div>
          </div>
        )}

        {loginError && (
          <p
            role="alert"
            className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-lg bg-red-50 px-5 py-3 text-sm text-red-600 shadow"
          >
            {loginError}
          </p>
        )}
      </>
    );
  }

  // Authenticated Application
  return (
    <>
      {currentPage === "dashboard" ? (
        <div>
          <div className="fixed right-5 top-5 z-20 flex items-center gap-3 rounded-full border border-gray-200 bg-white px-3 py-2 shadow-sm">
            {user.picture && (
              <img
                src={user.picture}
                alt="Profile"
                className="h-8 w-8 rounded-full"
              />
            )}

            <span className="max-w-36 truncate text-xs text-gray-700">
              {user.name || user.email}
            </span>

            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={isLoggingOut}
              className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium hover:bg-gray-200 disabled:opacity-50"
            >
              {isLoggingOut ? "Logging out..." : "Logout"}
            </button>
          </div>

          <Dashboard
            userId={user.id}
            onCompose={() =>
              setCurrentPage("compose")
            }
          />
        </div>
      ) : (
        <Compose
          userId={user.id}
          onBack={() =>
            setCurrentPage("dashboard")
          }
        />
      )}

      {loginError && (
        <p
          role="alert"
          className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-lg bg-red-50 px-5 py-3 text-sm text-red-600 shadow"
        >
          {loginError}
        </p>
      )}
    </>
  );
}

export default App;
