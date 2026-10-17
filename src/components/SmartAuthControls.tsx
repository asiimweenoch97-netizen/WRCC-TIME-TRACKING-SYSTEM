/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { User } from "../types";
import {
  Lock,
  Mail,
  User as UserIcon,
  ShieldCheck,
  Eye,
  EyeOff,
  AlertCircle,
  Key,
  CheckCircle2,
  ChevronDown,
} from "lucide-react";

interface SmartAuthControlsProps {
  onAuthSuccess: (user: User, token: string) => void;
  isLoginMode: boolean;
  onToggleMode: (isLogin: boolean) => void;
}

export default function SmartAuthControls({
  onAuthSuccess,
  isLoginMode,
}: SmartAuthControlsProps) {
  // Authentication Fields State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"staff" | "admin">("staff");
  const [adminSecret, setAdminSecret] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Rotating Admin Key Helper State
  const [fetchingAdminKey, setFetchingAdminKey] = useState(false);

  // Status & Error
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch rotating admin key from backend endpoint
  const fetchAdminKey = async () => {
    setFetchingAdminKey(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/admin-key-info");
      if (!res.ok) throw new Error("Key service temporary error");
      const data = await res.json();
      setAdminSecret(data.activeKey);
      setStatusMessage("Admin key retrieved!");
      setTimeout(() => setStatusMessage(null), 3000);
    } catch {
      setError("Failed to fetch active Admin Key. Please type it manually.");
    } finally {
      setFetchingAdminKey(false);
    }
  };

  // Form Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatusMessage(null);

    if (!email || !password) {
      setError("Email address and password are required.");
      return;
    }

    if (!isLoginMode) {
      if (!fullName) {
        setError("Please enter your full name.");
        return;
      }
      if (role === "admin" && !adminSecret) {
        setError("Admin verification key is required for administrator accounts.");
        return;
      }
    }

    setIsProcessing(true);

    try {
      const endpoint = isLoginMode ? "/api/auth/login" : "/api/auth/register";
      const payload = isLoginMode
        ? { email, password }
        : { email, fullName, role, password, adminSecret };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Authentication failed. Please check credentials.");
      }

      localStorage.setItem("wrc_token", data.token);
      localStorage.setItem("wrc_user", JSON.stringify(data.user));
      onAuthSuccess(data.user, data.token);
    } catch (err: any) {
      setError(err.message || "An error occurred during sign-in.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Error Banner */}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-300 p-3.5 flex items-start gap-2.5 text-xs text-red-900 font-medium">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-600 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      {/* Success Notification */}
      {statusMessage && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-300 p-3 flex items-center gap-2 text-xs text-emerald-900 font-semibold">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <div>{statusMessage}</div>
        </div>
      )}

      {/* Registration Field: Full Name */}
      {!isLoginMode && (
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Full Name
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <UserIcon className="w-4 h-4" />
            </div>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Sister Jane Smith"
              className="block w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3.5 py-3 text-slate-900 text-base sm:text-sm focus:border-amber-600 focus:outline-none shadow-xs font-medium min-h-[44px]"
            />
          </div>
        </div>
      )}

      {/* Email Address */}
      <div>
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
          Email Address
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Mail className="w-4 h-4" />
          </div>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="media.staff@church.org"
            className="block w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3.5 py-3 text-slate-900 text-base sm:text-sm focus:border-amber-600 focus:outline-none shadow-xs font-medium min-h-[44px]"
          />
        </div>
      </div>

      {/* Registration Field: Department Role */}
      {!isLoginMode && (
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
            Department Role
          </label>
          <div className="relative flex items-center">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "staff" | "admin")}
              className="block w-full appearance-none rounded-xl border border-slate-300 bg-white pl-9 pr-10 py-3 text-slate-900 text-base sm:text-sm focus:border-amber-600 focus:outline-none shadow-xs font-medium min-h-[44px] cursor-pointer"
            >
              <option value="staff">Media Crew Member (Staff)</option>
              <option value="admin">Media Lead (Administrator)</option>
            </select>
            <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-500">
              <ChevronDown className="w-4 h-4" />
            </div>
          </div>
        </div>
      )}

      {/* Registration Field: Admin Secret Verification Key */}
      {!isLoginMode && role === "admin" && (
        <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-300 space-y-2">
          <label className="block text-xs font-bold text-amber-900 uppercase tracking-wider">
            Admin Verification Key
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-amber-600">
                <Key className="w-3.5 h-3.5" />
              </div>
              <input
                type="text"
                value={adminSecret}
                onChange={(e) => setAdminSecret(e.target.value)}
                placeholder="Enter secret key"
                className="block w-full rounded-lg border border-amber-300 bg-white pl-8 pr-3 py-2.5 text-xs font-mono text-slate-900 focus:outline-none min-h-[40px]"
              />
            </div>
            <button
              type="button"
              onClick={fetchAdminKey}
              disabled={fetchingAdminKey}
              className="px-3.5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap min-h-[40px]"
            >
              {fetchingAdminKey ? "Retrieving..." : "Get Active Key"}
            </button>
          </div>
        </div>
      )}

      {/* Password Field */}
      <div>
        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
          Account Password
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Lock className="w-4 h-4" />
          </div>
          <input
            type={showPassword ? "text" : "password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="block w-full rounded-xl border border-slate-300 bg-white pl-9 pr-10 py-3 text-slate-900 text-base sm:text-sm focus:border-amber-600 focus:outline-none shadow-xs font-medium min-h-[44px]"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer min-w-[44px] justify-center"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Action Submit Button */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={isProcessing}
          className="w-full min-h-[48px] py-3.5 px-4 rounded-xl font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-md text-sm transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 active:scale-98"
        >
          <span>
            {isProcessing
              ? "Processing Account..."
              : isLoginMode
              ? "Sign In to Timesheets"
              : "Create Account & Sign In"}
          </span>
        </button>
      </div>
    </form>
  );
}
