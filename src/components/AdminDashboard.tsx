/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { User, TimesheetLog, DashboardStats } from "../types";
import AttendanceReports from "./AttendanceReports";
import {
  Users,
  Clock,
  Calendar,
  Search,
  FileDown,
  Trash2,
  Edit,
  Plus,
  RefreshCw,
  LogOut,
  Video,
  X,
  Check,
  AlertCircle,
  HelpCircle,
  BarChart3,
  TrendingUp,
  FileText,
  ChevronDown,
} from "lucide-react";

interface AdminDashboardProps {
  user: User;
  token: string;
  onLogout: () => void;
}

export default function AdminDashboard({ user, token, onLogout }: AdminDashboardProps) {
  // Main view switcher
  const [currentViewTab, setCurrentViewTab] = useState<"registry" | "reports">("registry");

  // Lists
  const [logs, setLogs] = useState<TimesheetLog[]>([]);
  const [staffList, setStaffList] = useState<{ id: string; fullName: string; email: string }[]>([]);

  // Statistics
  const [stats, setStats] = useState<DashboardStats>({
    totalStaff: 0,
    activeStaffCount: 0,
    totalHoursThisWeek: 0,
    totalCompletedTimesheets: 0,
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Loading States
  const [isLoading, setIsLoading] = useState(false);
  const [isStaffLoading, setIsStaffLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Manual Log Modal State
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualUserId, setManualUserId] = useState("");
  const [manualArrival, setManualArrival] = useState("");
  const [manualDeparture, setManualDeparture] = useState("");
  const [manualNotes, setManualNotes] = useState("");
  const [manualDepartureNotes, setManualDepartureNotes] = useState("");

  // Edit Log State
  const [editLogId, setEditLogId] = useState<string | null>(null);
  const [editArrival, setEditArrival] = useState("");
  const [editDeparture, setEditDeparture] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editDepartureNotes, setEditDepartureNotes] = useState("");
  const [editStatus, setEditStatus] = useState<"active" | "completed">("completed");

  // Fetch Stats
  const fetchStats = async () => {
    try {
      const res = await fetch("/api/admin/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error("Error loading stats:", err);
    }
  };

  // Fetch Staff list for dropdown
  const fetchStaff = async () => {
    setIsStaffLoading(true);
    try {
      const res = await fetch("/api/admin/staff", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setStaffList(data.staff);
      }
    } catch (err) {
      console.error("Error loading staff:", err);
    } finally {
      setIsStaffLoading(false);
    }
  };

  // Fetch Filtered Logs
  const fetchLogs = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);

      const res = await fetch(`/api/admin/timesheets?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load logs");
      setLogs(data.timesheets);
    } catch (err: any) {
      setError(err.message || "An error occurred fetching timesheets.");
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh everything
  const refreshAll = () => {
    fetchStats();
    fetchLogs();
    fetchStaff();
  };

  useEffect(() => {
    refreshAll();
  }, [token, searchQuery, startDate, endDate]);

  // Handle Manual Log Submission
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!manualUserId || !manualArrival || !manualDeparture) {
      setError("Please fill in all required manual log fields.");
      return;
    }

    try {
      const res = await fetch("/api/admin/timesheets/manual", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: manualUserId,
          arrivalTime: new Date(manualArrival).toISOString(),
          departureTime: new Date(manualDeparture).toISOString(),
          notes: manualNotes.trim() || "Manual Administrator Backfill",
          departureNotes: manualDepartureNotes.trim() || "Completed Shift Backfill",
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add manual timesheet");

      setSuccess("Manual timesheet backfilled successfully.");
      setShowManualModal(false);
      
      // Reset fields
      setManualUserId("");
      setManualArrival("");
      setManualDeparture("");
      setManualNotes("");
      setManualDepartureNotes("");

      refreshAll();
    } catch (err: any) {
      setError(err.message || "Failed to submit manual timesheet.");
    }
  };

  // Handle Delete Timesheet
  const handleDeleteLog = async (id: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this attendance record? This action cannot be undone.")) {
      return;
    }
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/admin/timesheets/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete timesheet");

      setSuccess("Record deleted successfully.");
      refreshAll();
    } catch (err: any) {
      setError(err.message || "Failed to delete record.");
    }
  };

  // Populate Editor fields
  const startEditLog = (log: TimesheetLog) => {
    setEditLogId(log.id);
    
    // Format ISO string to local input datetime format (YYYY-MM-DDTHH:MM)
    const formatToInputLocal = (isoStr: string | null) => {
      if (!isoStr) return "";
      const d = new Date(isoStr);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const hours = String(d.getHours()).padStart(2, "0");
      const minutes = String(d.getMinutes()).padStart(2, "0");
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    setEditArrival(formatToInputLocal(log.arrivalTime));
    setEditDeparture(formatToInputLocal(log.departureTime));
    setEditNotes(log.notes);
    setEditDepartureNotes(log.departureNotes || "");
    setEditStatus(log.status);
  };

  // Handle Edit Submission
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editLogId) return;

    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/admin/timesheets/${editLogId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          arrivalTime: editArrival ? new Date(editArrival).toISOString() : undefined,
          departureTime: editDeparture ? new Date(editDeparture).toISOString() : null,
          notes: editNotes.trim(),
          departureNotes: editDepartureNotes.trim() || null,
          status: editStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update record");

      setSuccess("Timesheet record updated successfully.");
      setEditLogId(null);
      refreshAll();
    } catch (err: any) {
      setError(err.message || "Failed to update record.");
    }
  };

  // Export to CSV Function
  const handleExportCSV = () => {
    if (logs.length === 0) {
      alert("No logs available to export.");
      return;
    }

    // Header definitions
    const headers = ["Member Name", "Email / Id", "Date", "Clock In Time", "Clock Out Time", "Total Hours", "Clock In Notes", "Clock Out Notes", "Status"];
    
    const calculateHoursNum = (start: string, end: string | null) => {
      if (!end) return 0;
      const s = new Date(start).getTime();
      const e = new Date(end).getTime();
      return parseFloat(((e - s) / (1000 * 60 * 60)).toFixed(2));
    };

    const csvRows = [
      headers.join(","), // Header line
      ...logs.map((log) => {
        const row = [
          log.fullName,
          log.userId, // Storing UID
          new Date(log.arrivalTime).toLocaleDateString(),
          new Date(log.arrivalTime).toLocaleTimeString(),
          log.departureTime ? new Date(log.departureTime).toLocaleTimeString() : "Still On-Duty",
          calculateHoursNum(log.arrivalTime, log.departureTime).toString(),
          log.notes.replace(/"/g, '""'), // Escape double quotes
          (log.departureNotes || "").replace(/"/g, '""'),
          log.status,
        ];
        // Enclose each column value in quotes to keep commas separate
        return row.map((val) => `"${val}"`).join(",");
      }),
    ];

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `WRC_Media_Timesheets_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Format Helpers
  const formatDate = (isoStr: string) => {
    return new Date(isoStr).toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (isoStr: string | null) => {
    if (!isoStr) return "--:--";
    return new Date(isoStr).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const calculateHours = (startIso: string, endIso: string | null) => {
    if (!endIso) return "Active";
    const start = new Date(startIso).getTime();
    const end = new Date(endIso).getTime();
    const diffMs = end - start;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Top Header */}
      <header className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 shadow-xs">
        <div className="w-full max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Identity */}
            <div className="flex items-center gap-3">
              <div className="bg-amber-600 text-white p-2 rounded-lg shadow-xs">
                <Video className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-display text-sm sm:text-base font-bold tracking-tight text-slate-900 leading-tight uppercase">
                  World Restoration Center Church
                </h1>
                <p className="font-sans text-[10px] sm:text-xs text-amber-700 font-bold tracking-wider uppercase">
                  Media Ministry Admin Dashboard
                </p>
              </div>
            </div>

            {/* Profile & Logout */}
            <div className="flex items-center gap-4">
              <div className="hidden md:flex flex-col text-right">
                <span className="text-sm font-bold text-slate-800">{user.fullName}</span>
                <span className="text-xs text-amber-700 font-bold uppercase tracking-wider">Lead Administrator</span>
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

      {/* Main Console */}
      <main className="w-full max-w-[1800px] mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
        
        {/* Admin Navigation Tabs Bar */}
        <div className="flex border border-slate-200 bg-slate-100 p-1.5 rounded-2xl shadow-xs">
          <button
            onClick={() => setCurrentViewTab("registry")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold uppercase tracking-wider transition-all cursor-pointer ${
              currentViewTab === "registry"
                ? "bg-slate-900 text-white shadow-md"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
            }`}
          >
            <FileText className="w-4 h-4 text-amber-500" />
            Attendance Registry & Backfill
          </button>
          <button
            onClick={() => setCurrentViewTab("reports")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold uppercase tracking-wider transition-all cursor-pointer ${
              currentViewTab === "reports"
                ? "bg-amber-600 text-white shadow-md"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Summary Reports & Attendance Trends
          </button>
        </div>

        {/* VIEW 1: ATTENDANCE REPORTS & TRENDS */}
        {currentViewTab === "reports" && (
          <AttendanceReports token={token} />
        )}

        {/* VIEW 2: ATTENDANCE REGISTRY & LOG MANAGEMENT */}
        {currentViewTab === "registry" && (
          <div className="space-y-8">
            {/* Statistics Widgets Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Card 1: Registered Media Team */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-md flex items-center gap-5">
            <div className="bg-amber-100 text-amber-800 p-4 rounded-xl border border-amber-300">
              <Users className="w-8 h-8" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                Registered Crew
              </span>
              <span className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight block font-sans">
                {stats.totalStaff}
              </span>
              <span className="text-xs text-slate-500 block font-medium mt-1">Unique accounts</span>
            </div>
          </div>

          {/* Card 2: On-Duty Active Members */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-md flex items-center gap-5">
            <div className="bg-blue-100 text-blue-800 p-4 rounded-xl border border-blue-300">
              <Clock className="w-8 h-8" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                Active On-Duty
              </span>
              <span className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight block font-sans">
                {stats.activeStaffCount}
              </span>
              <div className="mt-1.5">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-300 uppercase tracking-wider">
                  Currently clocked-in
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Total Hours Worked (Week) */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-md flex items-center gap-5">
            <div className="bg-indigo-100 text-indigo-800 p-4 rounded-xl border border-indigo-300">
              <Calendar className="w-8 h-8 animate-none" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                Hours This Week
              </span>
              <span className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight block font-sans">
                {stats.totalHoursThisWeek}h
              </span>
              <span className="text-xs text-slate-500 block font-medium mt-1">Accumulated sum</span>
            </div>
          </div>

          {/* Card 4: Total Sheets Logged */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-md flex items-center gap-5">
            <div className="bg-slate-100 text-slate-700 p-4 rounded-xl border border-slate-300">
              <Plus className="w-8 h-8 text-slate-700" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1">
                Total Logs
              </span>
              <span className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight block font-sans">
                {stats.totalCompletedTimesheets}
              </span>
              <span className="text-xs text-slate-500 block font-medium mt-1">Completed records</span>
            </div>
          </div>
        </div>

        {/* Messaging Logs alerts */}
        {success && (
          <div className="rounded-xl bg-emerald-50 border border-emerald-300 p-4 flex gap-3 text-sm text-emerald-900 shadow-xs font-semibold">
            <Check className="w-5 h-5 shrink-0 text-emerald-600" />
            <div className="font-semibold">{success}</div>
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-300 p-4 flex gap-3 text-sm text-red-900 shadow-xs font-semibold">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
            <div className="font-semibold">{error}</div>
          </div>
        )}

        {/* Active Members Mini-Feed */}
        {logs.filter(t => t.status === "active").length > 0 && (
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-300 uppercase tracking-wider">
                Active Feed
              </span>
              <h4 className="font-display font-bold text-slate-900 text-sm tracking-wider uppercase">
                Active On-Duty Crew
              </h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {logs.filter(t => t.status === "active").map((log) => (
                <div key={log.id} className="bg-white rounded-lg border border-slate-200 p-4 shadow-sm space-y-2 text-slate-900">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-bold text-slate-900">{log.fullName}</p>
                      <p className="text-xs text-slate-500 font-medium">{formatDate(log.arrivalTime)}</p>
                    </div>
                    <span className="text-xs font-sans font-bold text-blue-900 px-2 py-1 bg-blue-100 rounded border border-blue-300">
                      In: {formatTime(log.arrivalTime)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 bg-slate-50 p-2 rounded italic font-medium">
                    "{log.notes}"
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Main Timesheet Log and Filter Section */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-6 sm:p-8 space-y-6 text-slate-900">
          
          {/* Header Controls */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <h3 className="font-display text-lg font-bold text-slate-900 uppercase">
                Media Ministry Attendance Registry
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Filter, backfill, search, edit, or delete attendance sheets
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Backfill Manual Entry button */}
              <button
                onClick={() => setShowManualModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-all shadow-md cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Backfill Timesheet
              </button>

              {/* Export CSV Button */}
              <button
                onClick={handleExportCSV}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-amber-900 bg-amber-50 border border-amber-300 hover:bg-amber-100 rounded-lg transition-all shadow-xs cursor-pointer"
              >
                <FileDown className="w-4 h-4 text-amber-700" />
                Export CSV Sheet
              </button>

              {/* Reset Refresh */}
              <button
                onClick={refreshAll}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 transition-all cursor-pointer shadow-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* FILTER TOOLBAR */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            {/* Search Input */}
            <div className="md:col-span-2 relative">
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Search Team Member
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Type Name or Email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-amber-600 transition-colors shadow-xs"
                />
              </div>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                Start Date Filter
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-amber-600 transition-colors shadow-xs"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                End Date Filter
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-amber-600 transition-colors shadow-xs"
              />
            </div>
          </div>

          {/* EDIT LOG SUB-FORM INLINE */}
          {editLogId && (
            <div className="bg-amber-50/80 p-5 rounded-xl border border-amber-300 shadow-xs space-y-4">
              <div className="flex justify-between items-center border-b border-amber-300 pb-2">
                <h4 className="font-display font-bold text-amber-900 text-sm tracking-wider uppercase">
                  Modify Timesheet Record
                </h4>
                <button
                  onClick={() => setEditLogId(null)}
                  className="p-1 hover:text-red-600 text-slate-500 hover:bg-slate-200 rounded transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleEditSubmit} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Clock In Timestamp</label>
                  <input
                    type="datetime-local"
                    value={editArrival}
                    onChange={(e) => setEditArrival(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Clock Out Timestamp</label>
                  <input
                    type="datetime-local"
                    value={editDeparture}
                    onChange={(e) => setEditDeparture(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Timesheet Status</label>
                  <div className="relative flex items-center">
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value as "active" | "completed")}
                      className="w-full appearance-none bg-white border border-slate-300 rounded-lg pl-3 pr-8 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-600 cursor-pointer min-h-[36px] font-medium"
                    >
                      <option value="active" className="bg-white">Active (On-Duty)</option>
                      <option value="completed" className="bg-white">Completed (Clocked Out)</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-slate-500">
                      <ChevronDown className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="w-full flex items-center justify-center gap-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-3 py-2 text-xs font-bold shadow-sm transition-colors cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Save Adjustments
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditLogId(null)}
                    className="bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-lg px-3 py-2 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Clock-In Duty Details</label>
                  <input
                    type="text"
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-600"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Clock-Out Accomplishments</label>
                  <input
                    type="text"
                    value={editDepartureNotes}
                    onChange={(e) => setEditDepartureNotes(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-amber-600"
                  />
                </div>
              </form>
            </div>
          )}

          {/* MAIN DATA TABLE */}
          {isLoading && logs.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <svg className="animate-spin h-8 w-8 text-amber-600 mx-auto" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <p className="text-slate-500 text-sm font-medium">Re-indexing registry...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16 bg-slate-50 rounded-xl border border-dashed border-slate-300">
              <Users className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <p className="text-slate-900 font-bold text-sm">No recorded sheets match filter criteria</p>
              <p className="text-slate-500 text-xs mt-1 font-medium">
                Try widening your date filters or typing a different member's name.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-100 text-xs font-bold text-slate-700 uppercase tracking-wider">
                  <tr>
                    <th scope="col" className="px-8 py-5">Crew Member</th>
                    <th scope="col" className="px-8 py-5">Shift Date</th>
                    <th scope="col" className="px-8 py-5">Clock Times</th>
                    <th scope="col" className="px-8 py-5">Duration</th>
                    <th scope="col" className="px-8 py-5">Duty & Accomplishments</th>
                    <th scope="col" className="px-8 py-5 text-center">Digital Signatures</th>
                    <th scope="col" className="px-8 py-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      {/* Name */}
                      <td className="px-8 py-6 whitespace-nowrap">
                        <div className="font-bold text-base text-slate-900">{log.fullName}</div>
                        <div className="text-xs text-slate-500 font-mono select-all mt-1">{log.userId.slice(0, 8)}... (UID)</div>
                      </td>

                      {/* Date */}
                      <td className="px-8 py-6 whitespace-nowrap font-bold text-base text-slate-800">
                        {formatDate(log.arrivalTime)}
                      </td>

                      {/* Log times */}
                      <td className="px-8 py-6 whitespace-nowrap">
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-900 font-bold">In: {formatTime(log.arrivalTime)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-800 font-semibold">Out: {log.departureTime ? formatTime(log.departureTime) : "—"}</span>
                            {!log.departureTime && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-300 uppercase tracking-wider">
                                Active
                              </span>
                            )}
                            {log.departureTime && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300 uppercase tracking-wider">
                                Completed
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Duration */}
                      <td className="px-8 py-6 whitespace-nowrap">
                        {!log.departureTime ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-bold bg-blue-100 text-blue-900 border border-blue-300 uppercase tracking-wider">
                            On Shift
                          </span>
                        ) : (
                          (() => {
                            const start = new Date(log.arrivalTime).getTime();
                            const end = new Date(log.departureTime).getTime();
                            const diffMs = end - start;
                            const hours = Math.floor(diffMs / (1000 * 60 * 60));
                            const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                            return (
                              <div className="flex items-baseline gap-1 bg-slate-100 border border-slate-300 px-3 py-2 rounded-lg w-fit shadow-xs">
                                <span className="text-base font-extrabold text-slate-900 font-sans tracking-tight">
                                  {hours}
                                </span>
                                <span className="text-[10px] text-slate-600 font-bold mr-1.5 uppercase tracking-wider font-sans">
                                  hrs
                                </span>
                                <span className="text-base font-extrabold text-slate-900 font-sans tracking-tight">
                                  {minutes}
                                </span>
                                <span className="text-[10px] text-slate-600 font-bold uppercase tracking-wider font-sans">
                                  mins
                                </span>
                              </div>
                            );
                          })()
                        )}
                      </td>

                      {/* Notes */}
                      <td className="px-8 py-6">
                        <div className="max-w-xs space-y-2">
                          <p className="text-slate-800 font-medium text-sm line-clamp-3">
                            <span className="text-slate-500 text-[10px] uppercase font-bold block mb-0.5 tracking-wider">In Notes</span>
                            {log.notes}
                          </p>
                          {log.departureNotes && (
                             <p className="text-slate-600 italic text-xs border-t border-slate-200 pt-1.5 mt-1.5">
                               <span className="text-slate-500 text-[10px] uppercase font-bold block not-italic mb-0.5 tracking-wider">Out Notes</span>
                              {log.departureNotes}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Signatures Thumbnail */}
                      <td className="px-8 py-6 text-center">
                        <div className="inline-flex items-center gap-3 bg-slate-50 p-2 rounded-xl border border-slate-300">
                          {/* In Signature */}
                          <div className="text-center">
                            <span className="text-[9px] text-slate-500 block font-bold mb-1 uppercase tracking-wider">In</span>
                            <div className="w-16 h-10 bg-white rounded border border-slate-300 overflow-hidden flex items-center justify-center p-0.5">
                              {log.arrivalSignature ? (
                                <img
                                  src={log.arrivalSignature}
                                  alt="Arrival Sig"
                                  className="max-h-full max-w-full object-contain"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <span className="text-[10px] text-slate-400">None</span>
                              )}
                            </div>
                          </div>

                          {/* Out Signature */}
                          <div className="text-center">
                            <span className="text-[9px] text-slate-500 block font-bold mb-1 uppercase tracking-wider">Out</span>
                            <div className="w-16 h-10 bg-white rounded border border-slate-300 overflow-hidden flex items-center justify-center p-0.5">
                              {log.departureSignature ? (
                                <img
                                  src={log.departureSignature}
                                  alt="Departure Sig"
                                  className="max-h-full max-w-full object-contain"
                                  referrerPolicy="no-referrer"
                                />
                              ) : (
                                <span className="text-[10px] text-slate-400 font-medium">Pending</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-8 py-6 whitespace-nowrap text-right text-sm">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => startEditLog(log)}
                            className="p-1.5 border border-slate-300 text-slate-600 hover:text-amber-700 hover:border-amber-400 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer shadow-xs"
                            title="Edit Timesheet"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteLog(log.id)}
                            className="p-1.5 border border-slate-300 text-slate-500 hover:text-red-600 hover:border-red-300 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer shadow-xs"
                            title="Delete Timesheet"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      )}
      </main>

      {/* BACKFILL MANUAL LOG MODAL */}
      {showManualModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-zoom-in text-slate-900">
            {/* Modal Header */}
            <div className="bg-slate-100 text-slate-900 p-5 flex justify-between items-center border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-600" />
                <h3 className="font-display font-bold text-sm tracking-wider uppercase">
                  Backfill Missing Timesheet
                </h3>
              </div>
              <button
                onClick={() => setShowManualModal(false)}
                className="text-slate-500 hover:text-slate-800 rounded-lg p-1 hover:bg-slate-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Form */}
            <form onSubmit={handleManualSubmit} className="p-6 space-y-4">
              {/* Select Staff member */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Select Media Crew Member <span className="text-red-500">*</span>
                </label>
                <div className="relative flex items-center">
                  <select
                    required
                    value={manualUserId}
                    onChange={(e) => setManualUserId(e.target.value)}
                    className="w-full appearance-none rounded-lg border border-slate-300 pl-3.5 pr-10 py-2.5 text-slate-900 shadow-xs focus:border-amber-600 text-sm focus:outline-none bg-slate-50 focus:bg-white cursor-pointer min-h-[42px] font-medium"
                  >
                    <option value="" className="bg-white text-slate-500">-- Choose crew member --</option>
                    {staffList.map((st) => (
                      <option key={st.id} value={st.id} className="bg-white">
                        {st.fullName} ({st.email})
                      </option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-500">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
                {staffList.length === 0 && !isStaffLoading && (
                  <p className="text-xs text-amber-700 mt-1 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" />
                    No staff accounts registered yet. Members must sign up first.
                  </p>
                )}
              </div>

              {/* Arrival and departure timestamps */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Arrival Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={manualArrival}
                    onChange={(e) => setManualArrival(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-slate-900 shadow-xs text-sm focus:border-amber-600 focus:outline-none bg-slate-50 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">
                    Departure Time <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={manualDeparture}
                    onChange={(e) => setManualDeparture(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-slate-900 shadow-xs text-sm focus:border-amber-600 focus:outline-none bg-slate-50 focus:bg-white"
                  />
                </div>
              </div>

              {/* Arrival Notes */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Arrival Shift Notes
                </label>
                <input
                  type="text"
                  value={manualNotes}
                  onChange={(e) => setManualNotes(e.target.value)}
                  placeholder="e.g. Video editing, audio post-production, Sunday stream setup"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-slate-900 placeholder:text-slate-400 shadow-xs text-sm focus:border-amber-600 focus:outline-none bg-slate-50 focus:bg-white"
                />
              </div>

              {/* Departure Notes */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Departure Highlights (Optional)
                </label>
                <input
                  type="text"
                  value={manualDepartureNotes}
                  onChange={(e) => setManualDepartureNotes(e.target.value)}
                  placeholder="e.g. Completed video export, uploaded audio post-production assets"
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-slate-900 placeholder:text-slate-400 shadow-xs text-sm focus:border-amber-600 focus:outline-none bg-slate-50 focus:bg-white"
                />
              </div>

              {/* Buttons */}
              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 mt-2">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 text-sm font-bold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-bold shadow-md transition-colors cursor-pointer"
                >
                  Record Timesheet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
