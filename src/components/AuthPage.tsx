/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { User } from "../types";
import { Video } from "lucide-react";
import SmartAuthControls from "./SmartAuthControls";

interface AuthPageProps {
  onAuthSuccess: (user: User, token: string) => void;
}

export default function AuthPage({ onAuthSuccess }: AuthPageProps) {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      {/* Upper Logo / Banner Branding */}
      <div className="sm:mx-auto sm:w-full sm:max-w-xl text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-600 text-white shadow-md mb-4">
          <Video className="w-8 h-8" />
        </div>
        <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 uppercase">
          World Restoration Center Church
        </h2>
        <p className="font-display text-xs sm:text-sm tracking-widest text-amber-700 uppercase mt-1 font-bold">
          Media Department Timesheets Portal
        </p>
        <p className="mt-1 text-xs text-slate-600 font-medium">
          Digital Timesheet Entry & Attendance Verification
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-white py-6 px-4 shadow-xl border border-slate-200 rounded-3xl sm:px-8">
          {/* Sign In / Request Access Toggle Tabs */}
          <div className="flex border-b border-slate-200 mb-6">
            <button
              type="button"
              onClick={() => setIsLogin(true)}
              className={`w-1/2 pb-3 text-center text-sm font-extrabold transition-all cursor-pointer ${
                isLogin
                  ? "border-b-2 border-amber-600 text-slate-950"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setIsLogin(false)}
              className={`w-1/2 pb-3 text-center text-sm font-extrabold transition-all cursor-pointer ${
                !isLogin
                  ? "border-b-2 border-amber-600 text-slate-950"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Register New Account
            </button>
          </div>

          {/* Hardware Adaptive Authentication Controls */}
          <SmartAuthControls
            onAuthSuccess={onAuthSuccess}
            isLoginMode={isLogin}
            onToggleMode={setIsLogin}
          />

          {isLogin && (
            <div className="mt-6 border-t border-slate-200 pt-4 text-center">
              <span className="text-xs text-slate-500 font-medium">
                New Media Department Crew Member?{" "}
              </span>
              <button
                type="button"
                onClick={() => setIsLogin(false)}
                className="text-xs font-bold text-amber-700 hover:underline cursor-pointer"
              >
                Create Account & Register
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
