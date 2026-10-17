/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { User, TimesheetLog } from "../types";
import SignaturePad from "./SignaturePad";
import {
  Clock,
  LogOut,
  Calendar,
  FileText,
  Clock9,
  RefreshCw,
  Video,
  FileSpreadsheet,
  CheckCircle,
  Play,
  Check,
  User as UserIcon,
} from "lucide-react";

interface DashboardProps {
  user: User;
  token: string;
  onLogout: () => void;
}

export default function Dashboard({ user, token, onLogout }: DashboardProps) {
  const [activeLog, setActiveLog] = useState<TimesheetLog | null>(null);
  const [history, setHistory] = useState<TimesheetLog[]>([]);
  const [liveLocalTime, setLiveLocalTime] = useState(new Date());

  // Input States
  const [clockInNotes, setClockInNotes] = useState("");
  const [clockInSig, setClockInSig] = useState<string | null>(null);

  const [clockOutNotes, setClockOutNotes] = useState("");
  const [clockOutSig, setClockOutSig] = useState<string | null>(null);

  // Status/Error States
  const [isLoading, setIsLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Active duration state (HH:MM:SS)
  const [activeDuration, setActiveDuration] = useState("00:00:00");

  // Fetch active log and personal logs history
  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Fetch active log
      const activeRes = await fetch("/api/timesheets/active", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const activeData = await activeRes.json();
      if (!activeRes.ok) throw new Error(activeData.error || "Failed to load active timesheet");
      setActiveLog(activeData.active);

      // 2. Fetch history
      setIsHistoryLoading(true);
      const historyRes = await fetch("/api/timesheets/my-history", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const historyData = await historyRes.json();
      if (!historyRes.ok) throw new Error(historyData.error || "Failed to load timesheet history");
      setHistory(historyData.history);
    } catch (err: any) {
      setError(err.message || "An error occurred fetching data.");
    } finally {
      setIsLoading(false);
      setIsHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    // Live clock ticking
    const clockInterval = setInterval(() => {
      setLiveLocalTime(new Date());
    }, 1000);

    return () => clearInterval(clockInterval);
  }, [token]);

  // Active Clock Timer Ticking
  useEffect(() => {
    if (!activeLog) {
      setActiveDuration("00:00:00");
      return;
    }

    const updateTimer = () => {
      const start = new Date(activeLog.arrivalTime).getTime();
      const now = new Date().getTime();
      const diffMs = Math.max(0, now - start);

      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

      const pad = (num: number) => num.toString().padStart(2, "0");
      setActiveDuration(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`);
    };

    updateTimer(); // Initial call
    const timerInterval = setInterval(updateTimer, 1000);

    return () => clearInterval(timerInterval);
  }, [activeLog]);

  // Handle Clock In Submit
  const handleClockIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!clockInSig) {
      setError("Please draw your digital signature before clocking in.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/timesheets/clock-in", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          notes: clockInNotes.trim() || "Media Production & Ministry Support",
          arrivalSignature: clockInSig,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to clock in");

      setActiveLog(data.timesheet);
      setSuccessMsg("Clocked in successfully. Welcome to your shift!");
      setClockInNotes("");
      setClockInSig(null);
      fetchData(); // Refresh history
    } catch (err: any) {
      setError(err.message || "Failed to clock in.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Clock Out Submit
  const handleClockOut = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!clockOutSig) {
      setError("Please draw your digital signature before clocking out.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/timesheets/clock-out", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          departureNotes: clockOutNotes.trim() || "Shift Completed",
          departureSignature: clockOutSig,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to clock out");

      setActiveLog(null);
      setSuccessMsg("Clocked out successfully. Thank you for your service!");
      setClockOutNotes("");
      setClockOutSig(null);
      fetchData(); // Refresh list
    } catch (err: any) {
      setError(err.message || "Failed to clock out.");
    } finally {
      setIsLoading(false);
    }
  };

  // Helper: Format Date beautifully
  const formatDate = (isoStr: string) => {
    return new Date(isoStr).toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Helper: Format Time beautifully
  const formatTime = (isoStr: string | null) => {
    if (!isoStr) return "--:--";
    return new Date(isoStr).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Helper: Calculate duration between ISO strings
  const calculateHours = (startIso: string, endIso: string | null) => {
    if (!endIso) return "Active Duty";
    const start = new Date(startIso).getTime();
    const end = new Date(endIso).getTime();
    const diffMs = end - start;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Top Navigation */}
      <header className="bg-slate-50 border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="w-full max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap sm:flex-nowrap justify-between min-h-16 py-3 sm:py-0 items-center gap-3">
            {/* Header Identity */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="bg-amber-600 text-white p-2 rounded-lg shadow-xs shrink-0">
                <Video className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h1 className="font-display text-xs sm:text-sm md:text-base font-bold tracking-tight text-slate-900 leading-tight uppercase truncate sm:whitespace-normal">
                  World Restoration Center Church
                </h1>
                <p className="font-sans text-[10px] sm:text-xs text-amber-700 font-bold tracking-wider uppercase truncate">
                  Media Department Timesheets
                </p>
              </div>
            </div>

            {/* Profile & Live Header Clock & Logout */}
            <div className="flex items-center gap-3 sm:gap-4 shrink-0">
              {/* Header Live Mini Clock badge */}
              <div className="hidden lg:flex items-center gap-2 bg-slate-100 border border-slate-200 px-3 py-1 rounded-lg text-slate-700 font-mono text-xs font-semibold">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>
                  {liveLocalTime.toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: true
                  })}
                </span>
              </div>

              <div className="hidden md:flex flex-col text-right">
                <span className="text-sm font-bold text-slate-800">{user.fullName}</span>
                <span className="text-xs text-amber-700 font-semibold">Media Crew</span>
              </div>
              <button
                onClick={onLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-red-600 border border-slate-300 rounded-lg hover:bg-slate-100 transition-all cursor-pointer shadow-xs"
              >
                <LogOut className="w-3.5 h-3.5" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="w-full max-w-[1800px] mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Welcome Block + Live Clock */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 rounded-2xl p-6 sm:p-8 text-white shadow-xl border border-slate-800 relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <span className="inline-block px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-xs font-bold tracking-widest uppercase border border-amber-500/30">
                Media Department System
              </span>
              <h2 className="text-2xl sm:text-3xl font-display font-bold !text-white tracking-tight">
                Welcome back, {user.fullName}!
              </h2>
            </div>
            
            {/* Elegant Live Clock Panel */}
            <div className="bg-slate-950/90 backdrop-blur-md rounded-xl p-4 sm:p-5 border border-slate-700/80 text-center md:text-right flex flex-col items-center md:items-end justify-center min-w-[220px] shrink-0 shadow-lg">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs tracking-wider uppercase mb-1">
                <Clock className="w-4 h-4 text-amber-400 animate-pulse" />
                <span>Live Local Clock</span>
              </div>
              <div className="text-2xl sm:text-3xl font-mono font-bold tracking-tight text-white drop-shadow-xs">
                {liveLocalTime.toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: true
                })}
              </div>
              <div className="text-xs text-slate-300 font-semibold mt-1">
                {liveLocalTime.toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric"
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Messaging Area */}
        {successMsg && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-300 p-4 flex gap-3 text-sm text-emerald-900 animate-fade-in shadow-xs font-semibold">
            <CheckCircle className="w-5 h-5 shrink-0 text-emerald-600" />
            <div className="font-semibold">{successMsg}</div>
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-300 p-4 flex gap-3 text-sm text-red-900 animate-fade-in shadow-xs font-semibold">
            <CheckCircle className="w-5 h-5 shrink-0 text-red-600 rotate-45" />
            <div className="font-semibold">{error}</div>
          </div>
        )}

        {/* Grid Area: Clock In/Out Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT/MID SECTION: Active Tracking Panel */}
          <div className="lg:col-span-2 space-y-6">
            {!activeLog ? (
              /* CLOCK IN CARD */
              <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6 sm:p-8 space-y-6 text-slate-900">
                <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
                  <div className="bg-amber-100 text-amber-800 p-2.5 rounded-lg border border-amber-300">
                    <Play className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-bold text-slate-900">
                      Clock In for Shift
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Establish your arrival log for the Media Department
                    </p>
                  </div>
                </div>

                <form onSubmit={handleClockIn} className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-slate-500" />
                      Shift Notes / Service Details
                    </label>
                    <textarea
                      rows={2}
                      value={clockInNotes}
                      onChange={(e) => setClockInNotes(e.target.value)}
                      placeholder="e.g. Video Editing, Audio Post-Production, Sunday Morning Production, General Ministry Support, Administrative task"
                      className="block w-full rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-slate-900 shadow-xs placeholder:text-slate-400 focus:bg-white focus:border-amber-600 focus:ring-amber-500/20 text-sm focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Digital signature pad */}
                  <SignaturePad
                    id="clock_in_signature"
                    label="Digital Verification Signature"
                    userName={user.fullName}
                    userEmail={user.email}
                    onSave={(dataUrl) => setClockInSig(dataUrl)}
                  />

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-md text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 cursor-pointer"
                  >
                    <Clock9 className="w-4 h-4" />
                    Clock In Arrival Now
                  </button>
                </form>
              </div>
            ) : (
              /* CLOCK OUT CARD */
              <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6 sm:p-8 space-y-6 text-slate-900">
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-slate-100 text-slate-700 p-2.5 rounded-lg border border-slate-300">
                      <Clock9 className="w-5 h-5 text-slate-700" />
                    </div>
                    <div>
                      <h3 className="font-display text-lg font-bold text-slate-900">
                        Active Media Shift
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">
                        Provide departure log to complete this timesheet
                      </p>
                    </div>
                  </div>
                  
                  {/* Stable solid-color badge */}
                  <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-900 text-xs font-bold rounded-full border border-blue-300 uppercase tracking-wider">
                    On-Air Active
                  </div>
                </div>

                {/* Clock In Context Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 border border-slate-200 rounded-xl">
                  <div>
                    <span className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-0.5">
                      Shift Started
                    </span>
                    <p className="text-sm font-bold text-slate-900">
                      {formatTime(activeLog.arrivalTime)}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 font-medium">
                      {formatDate(activeLog.arrivalTime)}
                    </p>
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-0.5">
                      Arrival Notes
                    </span>
                    <p className="text-sm font-medium text-slate-800 italic">
                      "{activeLog.notes}"
                    </p>
                  </div>
                </div>

                {/* Big Visual Timer */}
                <div className="text-center py-6 bg-slate-900 text-white rounded-2xl space-y-1 border border-slate-800 border-b-4 border-amber-600 shadow-inner">
                  <span className="text-xs font-bold tracking-widest text-amber-400 uppercase">
                    Elapsed Service Time
                  </span>
                  <p className="text-4xl sm:text-5xl font-mono font-bold tracking-tight text-amber-400">
                    {activeDuration}
                  </p>
                  <p className="text-xs text-slate-400 font-medium">
                    Keep tab open. Duration will automatically sync on completion.
                  </p>
                </div>

                <form onSubmit={handleClockOut} className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                      <FileText className="w-4 h-4 text-slate-500" />
                      Departure notes / Wrap-up highlights (Optional)
                    </label>
                    <textarea
                      rows={2}
                      value={clockOutNotes}
                      onChange={(e) => setClockOutNotes(e.target.value)}
                      placeholder="e.g. Finished editing sermon video, completed audio mixdown, exported podcast, stored booth recorders"
                      className="block w-full rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-slate-900 shadow-xs placeholder:text-slate-400 focus:bg-white focus:border-amber-600 focus:ring-amber-500/20 text-sm focus:outline-none transition-colors"
                    />
                  </div>

                  {/* Departure digital signature */}
                  <SignaturePad
                    id="clock_out_signature"
                    label="Digital Verification Signature"
                    userName={user.fullName}
                    userEmail={user.email}
                    onSave={(dataUrl) => setClockOutSig(dataUrl)}
                  />

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-md text-sm font-bold text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    Clock Out Departure Now
                  </button>
                </form>
              </div>
            )}
          </div>

          {/* RIGHT SIDEBAR: Guidelines / Quick Instructions */}
          <div className="space-y-6">
            {/* Profile Info Card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6 space-y-4 text-slate-900">
              <h4 className="font-display font-bold text-slate-900 text-sm tracking-wide uppercase border-b border-slate-200 pb-2">
                My Profile
              </h4>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center font-bold">
                  {user.fullName.substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 leading-tight">{user.fullName}</p>
                  <p className="text-xs text-slate-600 font-medium">{user.email}</p>
                </div>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5">
                <p className="text-xs text-slate-600 flex justify-between font-medium">
                  <span>Authorized Role:</span>
                  <span className="font-bold text-slate-900 capitalize">{user.role}</span>
                </p>
                <p className="text-xs text-slate-600 flex justify-between font-medium">
                  <span>Registered:</span>
                  <span className="text-slate-800 font-semibold">{new Date(user.createdAt).toLocaleDateString()}</span>
                </p>
              </div>
            </div>

            {/* Department instructions card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6 space-y-4 text-slate-900">
              <h4 className="font-display font-bold text-slate-900 text-sm tracking-wide uppercase border-b border-slate-200 pb-2 flex items-center gap-1.5">
                <Check className="w-4 h-4 text-amber-600" />
                Media Crew Mandates
              </h4>
              <ul className="text-xs text-slate-700 space-y-3 leading-relaxed font-medium">
                <li className="flex gap-2">
                  <span className="text-amber-700 font-bold">1.</span>
                  <span><strong>Clock-in</strong> upon entering the production booth. Accurate times help budget equipment resources.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-amber-700 font-bold">2.</span>
                  <span>Describe specific service tasks (e.g. streaming, sound check, projection) in the <strong>Notes</strong> field.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-amber-700 font-bold">3.</span>
                  <span>A clean <strong>digital signature</strong> is required on both operations to establish personal identity and validation.</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-amber-700 font-bold">4.</span>
                  <span>Do not forget to <strong>clock out</strong> at the end of services so hours are tabulated cleanly!</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* BOTTOM SECTION: Personal Timesheet History Logs */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-6 sm:p-8 space-y-6 text-slate-900">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div className="flex items-center gap-3">
              <div className="bg-amber-100 text-amber-800 p-2 rounded-lg border border-amber-300">
                <Calendar className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-slate-900">
                  Personal Timesheet Logs
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Review your recorded history and total duty hours
                </p>
              </div>
            </div>
            
            {/* Refresh control */}
            <button
              onClick={fetchData}
              disabled={isHistoryLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 hover:text-slate-900 transition-colors cursor-pointer shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isHistoryLoading ? "animate-spin" : ""}`} />
              Refresh Logs
            </button>
          </div>

          {/* Historical Logs List */}
          {isHistoryLoading && history.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <svg className="animate-spin h-8 w-8 text-amber-600 mx-auto" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-slate-500 text-sm font-medium">Synchronizing logs...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300">
              <FileSpreadsheet className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <p className="text-slate-900 font-bold text-sm">No recorded timesheets yet</p>
              <p className="text-slate-500 text-xs mt-1 font-medium">
                Your future clocked shifts will display here with signatures.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-100 text-xs font-bold text-slate-700 uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="px-6 py-4">Date</th>
                    <th scope="col" className="px-6 py-4">Arrival Log</th>
                    <th scope="col" className="px-6 py-4">Departure Log</th>
                    <th scope="col" className="px-6 py-4">Total Hours</th>
                    <th scope="col" className="px-6 py-4">Notes</th>
                    <th scope="col" className="px-6 py-4 text-center">Signatures</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {history.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Date */}
                      <td className="whitespace-nowrap px-6 py-4 font-bold text-slate-900">
                        {formatDate(log.arrivalTime)}
                      </td>

                      {/* Arrival */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-slate-900 font-semibold">
                          {formatTime(log.arrivalTime)}
                        </div>
                        <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 mt-1">
                          Clocked In
                        </span>
                      </td>

                      {/* Departure */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-slate-900 font-semibold">
                          {formatTime(log.departureTime)}
                        </div>
                        {log.departureTime ? (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-300 mt-1">
                            Clocked Out
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-300 mt-1">
                            On Shift
                          </span>
                        )}
                      </td>

                      {/* Total Hours */}
                      <td className="px-6 py-4 whitespace-nowrap font-mono text-xs font-bold text-slate-900">
                        <span className="inline-block px-2.5 py-1 bg-slate-100 border border-slate-300 rounded-md">
                          {calculateHours(log.arrivalTime, log.departureTime)}
                        </span>
                      </td>

                      {/* Notes */}
                      <td className="px-6 py-4">
                        <div className="max-w-xs space-y-1">
                          <p className="text-slate-800 font-medium text-xs line-clamp-2">
                            <span className="text-slate-500 text-[10px] uppercase font-bold block">In Notes</span>
                            {log.notes}
                          </p>
                          {log.departureNotes && (
                            <p className="text-slate-600 italic text-[11px] border-t border-slate-200 pt-1">
                              <span className="text-slate-500 text-[10px] uppercase font-bold block not-italic">Out Notes</span>
                              {log.departureNotes}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Signatures Thumbnail */}
                      <td className="px-6 py-4 text-center">
                        <div className="inline-flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-300">
                          {/* In Signature */}
                          <div className="text-center">
                            <span className="text-[8px] text-slate-500 block font-bold mb-0.5 uppercase">In</span>
                            <div className="w-16 h-8 bg-white rounded border border-slate-300 overflow-hidden flex items-center justify-center p-0.5">
                              {log.arrivalSignature ? (
                                <img
                                  src={log.arrivalSignature}
                                  alt="Arrival Sig"
                                  className="max-h-full max-w-full object-contain"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <span className="text-[9px] text-slate-400">None</span>
                              )}
                            </div>
                          </div>

                          {/* Out Signature */}
                          <div className="text-center">
                            <span className="text-[8px] text-slate-500 block font-bold mb-0.5 uppercase">Out</span>
                            <div className="w-16 h-8 bg-white rounded border border-slate-300 overflow-hidden flex items-center justify-center p-0.5">
                              {log.departureSignature ? (
                                <img
                                  src={log.departureSignature}
                                  alt="Departure Sig"
                                  className="max-h-full max-w-full object-contain"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <span className="text-[9px] text-slate-400">Pending</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
