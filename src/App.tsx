/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { User } from "./types";
import AuthPage from "./components/AuthPage";
import Dashboard from "./components/Dashboard";
import AdminDashboard from "./components/AdminDashboard";
import { Video, AlertCircle } from "lucide-react";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Check current session on mount
  useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 5;

    const initializeAuth = async () => {
      const storedToken = localStorage.getItem("wrc_token");
      const storedUser = localStorage.getItem("wrc_user");

      if (storedToken && storedUser) {
        try {
          // Verify session token with backend
          const res = await fetch("/api/auth/me", {
            headers: {
              Authorization: `Bearer ${storedToken}`,
            },
          });

          if (!isMounted) return;

          if (res.ok) {
            const data = await res.json();
            setUser(data.user);
            setToken(storedToken);
          } else {
            // Token expired or invalid, clear storage
            localStorage.removeItem("wrc_token");
            localStorage.removeItem("wrc_user");
          }
        } catch (err) {
          if (!isMounted) return;
          console.error("Auth initialization failed. Server might be booting up.", err);
          if (retryCount < maxRetries) {
            retryCount++;
            setConnectionError(`Connecting to server (Attempt ${retryCount}/${maxRetries})...`);
            setTimeout(initializeAuth, 2000);
            return;
          } else {
            setConnectionError("Server connection timed out. Please click retry below or refresh.");
          }
        }
      }
      if (isMounted) {
        setIsLoading(false);
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleAuthSuccess = (authenticatedUser: User, sessionToken: string) => {
    setUser(authenticatedUser);
    setToken(sessionToken);
  };

  const handleLogout = async () => {
    if (token) {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } catch (err) {
        console.error("Logout request failed:", err);
      }
    }

    // Always clear local state
    localStorage.removeItem("wrc_token");
    localStorage.removeItem("wrc_user");
    setUser(null);
    setToken(null);
  };

  // Full Page Loading View
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
        <div className="text-center space-y-4">
          <div className="relative inline-flex">
            <div className="bg-slate-100 text-slate-700 p-4 rounded-full border border-slate-300 shadow-sm relative z-10">
              <Video className="w-8 h-8" />
            </div>
          </div>
          <h2 className="font-display text-lg font-bold text-slate-900 tracking-wider uppercase">
            World Restoration Center Church
          </h2>
          <p className="text-xs text-slate-600 tracking-widest uppercase font-semibold">
            Loading Media Timesheet Engine...
          </p>

          {connectionError && (
            <div className="max-w-xs mx-auto p-3 bg-amber-50 rounded-lg border border-amber-300 text-xs text-amber-900 flex items-center justify-center gap-2 animate-fade-in mt-4 font-semibold">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{connectionError}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Auth Portal
  if (!user || !token) {
    return <AuthPage onAuthSuccess={handleAuthSuccess} />;
  }

  // Admin View
  if (user.role === "admin") {
    return (
      <AdminDashboard
        user={user}
        token={token}
        onLogout={handleLogout}
      />
    );
  }

  // Staff View
  return (
    <Dashboard
      user={user}
      token={token}
      onLogout={handleLogout}
    />
  );
}
