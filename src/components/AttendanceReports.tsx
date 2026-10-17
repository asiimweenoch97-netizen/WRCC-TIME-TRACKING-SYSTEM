/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { AttendanceReport, WeeklySummary, MonthlySummary, StaffReportSummary } from "../types";
import {
  BarChart3,
  TrendingUp,
  Calendar,
  Users,
  Clock,
  FileDown,
  Printer,
  RefreshCw,
  Award,
  ChevronDown,
  ChevronUp,
  Filter,
  CheckCircle2,
  CalendarDays,
  PieChart,
  ArrowUpRight,
  Eye,
  EyeOff,
} from "lucide-react";

interface AttendanceReportsProps {
  token: string;
}

export default function AttendanceReports({ token }: AttendanceReportsProps) {
  const [period, setPeriod] = useState<"week" | "month" | "quarter" | "year" | "custom">("month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [activeTab, setActiveTab] = useState<"trends" | "weekly" | "monthly" | "staff">("trends");

  const [reportData, setReportData] = useState<AttendanceReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Expandable table rows
  const [expandedWeekKey, setExpandedWeekKey] = useState<string | null>(null);
  const [expandedMonthKey, setExpandedMonthKey] = useState<string | null>(null);
  const [expandedStaffId, setExpandedStaffId] = useState<string | null>(null);

  // Hovered trend point
  const [hoveredTrendIndex, setHoveredTrendIndex] = useState<number | null>(null);

  // Fetch report data
  const fetchReport = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append("period", period);
      if (period === "custom") {
        if (customStart) params.append("startDate", customStart);
        if (customEnd) params.append("endDate", customEnd);
      }

      const res = await fetch(`/api/admin/reports?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load attendance report");
      setReportData(data.report);
    } catch (err: any) {
      setError(err.message || "Error loading report metrics.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [token, period]);

  const handleCustomFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (period === "custom") {
      fetchReport();
    }
  };

  // CSV Exporters
  const exportWeeklyCSV = () => {
    if (!reportData || reportData.weeklySummaries.length === 0) {
      alert("No weekly data available to export.");
      return;
    }

    const headers = ["Week Period", "Start Date", "End Date", "Total Hours", "Total Shifts", "Active Crew Count", "Avg Hours / Shift"];
    const rows = reportData.weeklySummaries.map((w) => [
      `"${w.weekLabel}"`,
      `"${w.startDate.slice(0, 10)}"`,
      `"${w.endDate.slice(0, 10)}"`,
      w.totalHours,
      w.shiftCount,
      w.activeStaffCount,
      w.avgHoursPerShift,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `WRC_Weekly_Attendance_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportMonthlyCSV = () => {
    if (!reportData || reportData.monthlySummaries.length === 0) {
      alert("No monthly data available to export.");
      return;
    }

    const headers = ["Month", "Year", "Total Hours", "Total Shifts", "Active Crew Count", "Avg Hours / Shift"];
    const rows = reportData.monthlySummaries.map((m) => [
      `"${m.monthLabel}"`,
      m.year,
      m.totalHours,
      m.shiftCount,
      m.activeStaffCount,
      m.avgHoursPerShift,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `WRC_Monthly_Attendance_Report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportStaffCSV = () => {
    if (!reportData || reportData.staffSummaries.length === 0) {
      alert("No staff data available to export.");
      return;
    }

    const headers = ["Crew Member", "Email", "Total Shifts", "Total Hours Served", "Avg Hours / Shift", "Last Active Date"];
    const rows = reportData.staffSummaries.map((s) => [
      `"${s.fullName}"`,
      `"${s.email}"`,
      s.totalShifts,
      s.totalHours,
      s.avgShiftHours,
      `"${s.lastActive ? new Date(s.lastActive).toLocaleDateString() : "Never"}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `WRC_Staff_Attendance_Summary_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8 print:p-0">
      {/* SECTION HEADER & CONTROL TOOLBAR */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl p-6 sm:p-8 space-y-6 print:border-none print:shadow-none print:p-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5 print:hidden">
          <div className="flex items-center gap-3">
            <div className="bg-amber-600 text-white p-2.5 rounded-xl shadow-md">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-display text-lg sm:text-xl font-bold text-slate-900 uppercase tracking-tight">
                Attendance Analytics & Summary Reports
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Comprehensive weekly/monthly attendance summaries & shift trends
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-all shadow-xs cursor-pointer"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              Print Report
            </button>

            <button
              onClick={fetchReport}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-300 rounded-lg hover:bg-slate-200 transition-all cursor-pointer shadow-xs"
              title="Refresh Report Data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-amber-600" : ""}`} />
            </button>
          </div>
        </div>

        {/* TIME PERIOD SELECTOR BAR */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 print:hidden">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1 mr-2">
              <Filter className="w-3.5 h-3.5 text-amber-600" />
              Period:
            </span>
            {(["week", "month", "quarter", "year", "custom"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer uppercase tracking-wider ${
                  period === p
                    ? "bg-amber-600 text-white shadow-xs"
                    : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-100"
                }`}
              >
                {p === "week" ? "Last 7 Days" : p === "month" ? "Last 30 Days" : p === "quarter" ? "Last 90 Days" : p === "year" ? "Past Year" : "Custom Range"}
              </button>
            ))}
          </div>

          {period === "custom" && (
            <form onSubmit={handleCustomFilterSubmit} className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                required
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-amber-600"
              />
              <span className="text-xs text-slate-500 font-bold">to</span>
              <input
                type="date"
                required
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-xs text-slate-900 focus:outline-none focus:border-amber-600"
              />
              <button
                type="submit"
                className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer"
              >
                Apply
              </button>
            </form>
          )}
        </div>

        {/* REPORT SUB-TABS */}
        <div className="flex border-b border-slate-200 overflow-x-auto print:hidden">
          <button
            onClick={() => setActiveTab("trends")}
            className={`flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer uppercase tracking-wider ${
              activeTab === "trends"
                ? "border-amber-600 text-amber-700 bg-amber-50/50"
                : "border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300"
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Visual Trends
          </button>

          <button
            onClick={() => setActiveTab("weekly")}
            className={`flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer uppercase tracking-wider ${
              activeTab === "weekly"
                ? "border-amber-600 text-amber-700 bg-amber-50/50"
                : "border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300"
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            Weekly Summaries ({reportData?.weeklySummaries.length || 0})
          </button>

          <button
            onClick={() => setActiveTab("monthly")}
            className={`flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer uppercase tracking-wider ${
              activeTab === "monthly"
                ? "border-amber-600 text-amber-700 bg-amber-50/50"
                : "border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300"
            }`}
          >
            <Calendar className="w-4 h-4" />
            Monthly Summaries ({reportData?.monthlySummaries.length || 0})
          </button>

          <button
            onClick={() => setActiveTab("staff")}
            className={`flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer uppercase tracking-wider ${
              activeTab === "staff"
                ? "border-amber-600 text-amber-700 bg-amber-50/50"
                : "border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300"
            }`}
          >
            <Users className="w-4 h-4" />
            Crew Performance ({reportData?.staffSummaries.length || 0})
          </button>
        </div>

        {/* LOADING & ERROR STATES */}
        {isLoading && (
          <div className="py-16 text-center space-y-3">
            <svg className="animate-spin h-8 w-8 text-amber-600 mx-auto" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-slate-500 text-sm font-medium">Aggregating attendance statistics...</p>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-300 text-red-800 rounded-xl text-sm font-semibold">
            {error}
          </div>
        )}

        {!isLoading && reportData && (
          <div className="space-y-8">
            
            {/* KPI OVERVIEW CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Card 1: Total Hours Served */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Total Hours Served
                  </span>
                  <div className="p-2 bg-amber-50 text-amber-700 rounded-lg">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-slate-900 font-sans tracking-tight">
                  {reportData.overallMetrics.totalHours}h
                </div>
                <span className="text-xs text-slate-500 mt-1 block font-medium">
                  Across all shifts in timeframe
                </span>
              </div>

              {/* Card 2: Shifts Completed */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Total Media Shifts
                  </span>
                  <div className="p-2 bg-blue-50 text-blue-700 rounded-lg">
                    <BarChart3 className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-slate-900 font-sans tracking-tight">
                  {reportData.overallMetrics.totalShifts}
                </div>
                <span className="text-xs text-slate-500 mt-1 block font-medium">
                  Logged timesheets
                </span>
              </div>

              {/* Card 3: Avg Shift Duration */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Avg Shift Duration
                  </span>
                  <div className="p-2 bg-indigo-50 text-indigo-700 rounded-lg">
                    <Calendar className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-slate-900 font-sans tracking-tight">
                  {reportData.overallMetrics.avgShiftDurationHours}h
                </div>
                <span className="text-xs text-slate-500 mt-1 block font-medium">
                  Per logged attendance
                </span>
              </div>

              {/* Card 4: Top Contributor */}
              <div className="bg-white p-5 rounded-xl border border-amber-200 bg-amber-50/20 shadow-sm relative overflow-hidden">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-amber-800 uppercase tracking-wider">
                    Top Contributor
                  </span>
                  <div className="p-2 bg-amber-100 text-amber-800 rounded-lg">
                    <Award className="w-4 h-4" />
                  </div>
                </div>
                {reportData.overallMetrics.topContributor ? (
                  <div>
                    <div className="text-lg font-bold text-slate-900 truncate">
                      {reportData.overallMetrics.topContributor.fullName}
                    </div>
                    <div className="text-xs font-semibold text-amber-700 mt-0.5">
                      {reportData.overallMetrics.topContributor.totalHours} hrs served ({reportData.overallMetrics.topContributor.shifts} shifts)
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-slate-500 italic">No activity yet</span>
                )}
              </div>
            </div>

            {/* TAB 1: VISUAL TRENDS & CHARTS */}
            {activeTab === "trends" && (
              <div className="space-y-8 animate-fade-in">
                
                {/* ATTENDANCE HOURS TREND CHART (SVG) */}
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="font-display text-base font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-amber-600" />
                        Daily Attendance Hours Trend
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">
                        Hours served by the media team day-by-day over selected period
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-semibold text-slate-600">
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-3 bg-amber-500 rounded-sm inline-block"></span> Total Hours
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-3 bg-blue-500 rounded-full inline-block"></span> Shift Count
                      </span>
                    </div>
                  </div>

                  {reportData.dailyTrends.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 text-xs">No daily trend points available for this period.</div>
                  ) : (
                    <div className="relative pt-6 pb-2">
                      {/* SVG Bar / Line Graph */}
                      {(() => {
                        const trends = reportData.dailyTrends;
                        const maxHours = Math.max(...trends.map((t) => t.totalHours), 5);

                        return (
                          <div className="space-y-4">
                            <div className="h-56 w-full flex items-end gap-1 sm:gap-2 px-2 border-b border-slate-200 relative pt-6">
                              
                              {/* Background gridlines */}
                              <div className="absolute inset-x-0 top-0 border-t border-slate-100 text-[9px] text-slate-400 pl-1 font-mono">
                                {maxHours}h
                              </div>
                              <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-slate-100 text-[9px] text-slate-400 pl-1 font-mono">
                                {parseFloat((maxHours / 2).toFixed(1))}h
                              </div>

                              {trends.map((t, idx) => {
                                const heightPercent = Math.max(5, (t.totalHours / maxHours) * 100);
                                const isHovered = hoveredTrendIndex === idx;

                                return (
                                  <div
                                    key={t.date}
                                    onMouseEnter={() => setHoveredTrendIndex(idx)}
                                    onMouseLeave={() => setHoveredTrendIndex(null)}
                                    className="flex-1 flex flex-col items-center h-full justify-end relative group cursor-pointer"
                                  >
                                    {/* Tooltip on hover */}
                                    {isHovered && (
                                      <div className="absolute bottom-full mb-2 z-20 bg-slate-900 text-white text-[11px] rounded-lg p-2.5 shadow-xl whitespace-nowrap pointer-events-none animate-fade-in font-sans">
                                        <div className="font-bold text-amber-400 border-b border-slate-700 pb-1 mb-1">
                                          {t.dayOfWeek}, {t.dateLabel}
                                        </div>
                                        <div className="flex justify-between gap-3">
                                          <span className="text-slate-300">Total Hours:</span>
                                          <span className="font-bold">{t.totalHours}h</span>
                                        </div>
                                        <div className="flex justify-between gap-3">
                                          <span className="text-slate-300">Shifts Logged:</span>
                                          <span className="font-bold text-blue-400">{t.shiftCount}</span>
                                        </div>
                                        <div className="flex justify-between gap-3">
                                          <span className="text-slate-300">Active Crew:</span>
                                          <span className="font-bold text-emerald-400">{t.uniqueStaffCount}</span>
                                        </div>
                                      </div>
                                    )}

                                    {/* Bar Element */}
                                    <div
                                      style={{ height: `${heightPercent}%` }}
                                      className={`w-full rounded-t-md transition-all duration-300 relative ${
                                        t.totalHours > 0
                                          ? isHovered
                                            ? "bg-amber-600 shadow-md"
                                            : "bg-amber-500 hover:bg-amber-600"
                                          : "bg-slate-100"
                                      }`}
                                    >
                                      {/* Shift Count Indicator Dot */}
                                      {t.shiftCount > 0 && (
                                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-blue-600 rounded-full ring-2 ring-white shadow-xs" />
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* X-Axis Labels */}
                            <div className="flex justify-between gap-1 px-2 text-[10px] text-slate-500 font-medium overflow-hidden">
                              {trends.map((t, i) => {
                                // Display select labels if too many points
                                const showLabel = trends.length <= 14 || i % Math.ceil(trends.length / 10) === 0 || i === trends.length - 1;
                                return (
                                  <div key={t.date} className="flex-1 text-center truncate">
                                    {showLabel ? `${t.dayOfWeek} ${t.dateLabel.split(" ")[1] || ""}` : ""}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* TWO-COLUMN GRID: Day-of-Week Distribution & Crew Workload Ranking */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
                  {/* CHART 1: Day of Week Attendance (Sunday vs Midweek Services) */}
                  <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
                    <div className="border-b border-slate-100 pb-3">
                      <h3 className="font-display text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                        <PieChart className="w-4 h-4 text-amber-600" />
                        Service & Ministry Day Distribution
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">
                        Comparing Sunday Service coverage vs Midweek shifts
                      </p>
                    </div>

                    <div className="space-y-3 pt-2">
                      {(() => {
                        const dow = reportData.dayOfWeekBreakdown;
                        const maxDowHours = Math.max(...dow.map((d) => d.totalHours), 1);

                        return dow.map((d) => {
                          const percent = Math.round((d.totalHours / maxDowHours) * 100);
                          const isSunday = d.day === "Sunday";
                          return (
                            <div key={d.day} className="space-y-1">
                              <div className="flex justify-between text-xs font-semibold">
                                <span className={`flex items-center gap-1.5 ${isSunday ? "text-amber-800 font-bold" : "text-slate-700"}`}>
                                  {isSunday && <span className="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-bold uppercase">Main Service</span>}
                                  {d.day}
                                </span>
                                <span className="text-slate-900 font-mono">
                                  {d.totalHours} hrs <span className="text-slate-400 text-[10px]">({d.shiftCount} shifts)</span>
                                </span>
                              </div>
                              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
                                <div
                                  style={{ width: `${percent}%` }}
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    isSunday ? "bg-amber-600" : "bg-slate-700"
                                  }`}
                                />
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  {/* CHART 2: Top Media Crew Contributor Leaderboard */}
                  <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
                    <div className="border-b border-slate-100 pb-3">
                      <h3 className="font-display text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                        <Award className="w-4 h-4 text-amber-600" />
                        Media Crew Workload Leaderboard
                      </h3>
                      <p className="text-xs text-slate-500 font-medium">
                        Hours served by crew members during this reporting period
                      </p>
                    </div>

                    <div className="space-y-4 pt-2 max-h-72 overflow-y-auto pr-1">
                      {reportData.staffSummaries.length === 0 ? (
                        <p className="text-xs text-slate-500 text-center py-8">No staff activity recorded yet.</p>
                      ) : (
                        (() => {
                          const topHours = Math.max(...reportData.staffSummaries.map((s) => s.totalHours), 1);
                          return reportData.staffSummaries.map((s, idx) => {
                            const percent = Math.round((s.totalHours / topHours) * 100);
                            return (
                              <div key={s.userId} className="space-y-1.5">
                                <div className="flex justify-between items-center text-xs">
                                  <div className="flex items-center gap-2 font-bold text-slate-800">
                                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-sans ${
                                      idx === 0 ? "bg-amber-500 text-white" : idx === 1 ? "bg-slate-300 text-slate-800" : idx === 2 ? "bg-amber-800 text-white" : "bg-slate-100 text-slate-600"
                                    }`}>
                                      {idx + 1}
                                    </span>
                                    <span className="truncate max-w-[140px] sm:max-w-xs">{s.fullName}</span>
                                  </div>
                                  <div className="text-right font-mono text-slate-900 font-bold">
                                    {s.totalHours} hrs <span className="text-[10px] text-slate-500 font-sans font-normal">({s.totalShifts} shifts)</span>
                                  </div>
                                </div>
                                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div
                                    style={{ width: `${percent}%` }}
                                    className={`h-full rounded-full transition-all duration-500 ${
                                      idx === 0 ? "bg-amber-600" : "bg-slate-800"
                                    }`}
                                  />
                                </div>
                              </div>
                            );
                          });
                        })()
                      )}
                    </div>
                  </div>

                </div>
              </div>
            )}

            {/* TAB 2: WEEKLY SUMMARY REPORTS */}
            {activeTab === "weekly" && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                  <div>
                    <h3 className="font-display text-base font-bold text-slate-900 uppercase tracking-wider">
                      Weekly Attendance Summary Breakdown
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Aggregated week-by-week shift metrics and active crew counts
                    </p>
                  </div>
                  <button
                    onClick={exportWeeklyCSV}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-amber-900 bg-amber-50 border border-amber-300 hover:bg-amber-100 rounded-lg transition-all shadow-xs cursor-pointer w-fit"
                  >
                    <FileDown className="w-4 h-4 text-amber-700" />
                    Export Weekly CSV
                  </button>
                </div>

                {reportData.weeklySummaries.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-500 text-xs">
                    No weekly records found in the selected date range.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                      <thead className="bg-slate-100 text-xs font-bold text-slate-700 uppercase tracking-wider">
                        <tr>
                          <th scope="col" className="px-6 py-4">Week Period</th>
                          <th scope="col" className="px-6 py-4">Active Crew</th>
                          <th scope="col" className="px-6 py-4">Total Shifts</th>
                          <th scope="col" className="px-6 py-4">Total Hours</th>
                          <th scope="col" className="px-6 py-4">Avg Shift Length</th>
                          <th scope="col" className="px-6 py-4 text-right">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {reportData.weeklySummaries.map((w) => {
                          const isExpanded = expandedWeekKey === w.weekKey;
                          return (
                            <React.Fragment key={w.weekKey}>
                              <tr className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 font-bold text-slate-900 whitespace-nowrap">
                                  {w.weekLabel}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-bold bg-blue-100 text-blue-900 border border-blue-200">
                                    {w.activeStaffCount} members
                                  </span>
                                </td>
                                <td className="px-6 py-4 font-bold text-slate-800 whitespace-nowrap">
                                  {w.shiftCount} shifts
                                </td>
                                <td className="px-6 py-4 font-extrabold text-amber-900 font-sans text-base whitespace-nowrap">
                                  {w.totalHours} hrs
                                </td>
                                <td className="px-6 py-4 font-semibold text-slate-700 whitespace-nowrap">
                                  {w.avgHoursPerShift} hrs / shift
                                </td>
                                <td className="px-6 py-4 text-right whitespace-nowrap">
                                  <button
                                    onClick={() => setExpandedWeekKey(isExpanded ? null : w.weekKey)}
                                    className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                                      isExpanded
                                        ? "text-amber-900 bg-amber-100 border-amber-300 shadow-xs"
                                        : "text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border-slate-300"
                                    }`}
                                    title={isExpanded ? "Hide Crew Breakdown" : "View Crew Breakdown"}
                                  >
                                    {isExpanded ? (
                                      <Eye className="w-3.5 h-3.5 text-amber-700" />
                                    ) : (
                                      <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                                    )}
                                    <span>{isExpanded ? "Hide Breakdown" : "Crew Roster"}</span>
                                  </button>
                                </td>
                              </tr>

                              {/* EXPANDED WEEKLY CREW BREAKDOWN */}
                              {isExpanded && (
                                <tr className="bg-slate-50/80">
                                  <td colSpan={6} className="px-6 py-4">
                                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-100 pb-2">
                                        Crew Roster Breakdown for {w.weekLabel}
                                      </h4>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                        {w.staffBreakdown.map((sb) => (
                                          <div key={sb.userId} className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center text-xs">
                                            <div>
                                              <span className="font-bold text-slate-900 block">{sb.fullName}</span>
                                              <span className="text-slate-500 font-medium">{sb.shifts} shift(s)</span>
                                            </div>
                                            <span className="font-mono font-bold text-amber-800 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                                              {sb.totalHours} hrs
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: MONTHLY SUMMARY REPORTS */}
            {activeTab === "monthly" && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                  <div>
                    <h3 className="font-display text-base font-bold text-slate-900 uppercase tracking-wider">
                      Monthly Attendance Summary Breakdown
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      High-level monthly church service attendance and crew hours
                    </p>
                  </div>
                  <button
                    onClick={exportMonthlyCSV}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-amber-900 bg-amber-50 border border-amber-300 hover:bg-amber-100 rounded-lg transition-all shadow-xs cursor-pointer w-fit"
                  >
                    <FileDown className="w-4 h-4 text-amber-700" />
                    Export Monthly CSV
                  </button>
                </div>

                {reportData.monthlySummaries.length === 0 ? (
                  <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-500 text-xs">
                    No monthly records found in the selected date range.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                      <thead className="bg-slate-100 text-xs font-bold text-slate-700 uppercase tracking-wider">
                        <tr>
                          <th scope="col" className="px-6 py-4">Month</th>
                          <th scope="col" className="px-6 py-4">Active Crew</th>
                          <th scope="col" className="px-6 py-4">Total Shifts</th>
                          <th scope="col" className="px-6 py-4">Total Hours Served</th>
                          <th scope="col" className="px-6 py-4">Avg Shift Length</th>
                          <th scope="col" className="px-6 py-4 text-right">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 bg-white">
                        {reportData.monthlySummaries.map((m) => {
                          const isExpanded = expandedMonthKey === m.monthKey;
                          return (
                            <React.Fragment key={m.monthKey}>
                              <tr className="hover:bg-slate-50 transition-colors">
                                <td className="px-6 py-4 font-bold text-slate-900 whitespace-nowrap text-base">
                                  {m.monthLabel}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-bold bg-blue-100 text-blue-900 border border-blue-200">
                                    {m.activeStaffCount} members
                                  </span>
                                </td>
                                <td className="px-6 py-4 font-bold text-slate-800 whitespace-nowrap">
                                  {m.shiftCount} shifts
                                </td>
                                <td className="px-6 py-4 font-extrabold text-amber-900 font-sans text-lg whitespace-nowrap">
                                  {m.totalHours} hrs
                                </td>
                                <td className="px-6 py-4 font-semibold text-slate-700 whitespace-nowrap">
                                  {m.avgHoursPerShift} hrs / shift
                                </td>
                                <td className="px-6 py-4 text-right whitespace-nowrap">
                                  <button
                                    onClick={() => setExpandedMonthKey(isExpanded ? null : m.monthKey)}
                                    className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                                      isExpanded
                                        ? "text-amber-900 bg-amber-100 border-amber-300 shadow-xs"
                                        : "text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border-slate-300"
                                    }`}
                                    title={isExpanded ? "Hide Monthly Roster" : "View Monthly Roster"}
                                  >
                                    {isExpanded ? (
                                      <Eye className="w-3.5 h-3.5 text-amber-700" />
                                    ) : (
                                      <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                                    )}
                                    <span>{isExpanded ? "Hide Roster" : "Monthly Roster"}</span>
                                  </button>
                                </td>
                              </tr>

                              {/* EXPANDED MONTHLY CREW BREAKDOWN */}
                              {isExpanded && (
                                <tr className="bg-slate-50/80">
                                  <td colSpan={6} className="px-6 py-4">
                                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-100 pb-2">
                                        Crew Workload Summary for {m.monthLabel}
                                      </h4>
                                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                        {m.staffBreakdown.map((sb) => (
                                          <div key={sb.userId} className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex justify-between items-center text-xs">
                                            <div>
                                              <span className="font-bold text-slate-900 block">{sb.fullName}</span>
                                              <span className="text-slate-500 font-medium">{sb.shifts} shift(s)</span>
                                            </div>
                                            <span className="font-mono font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded border border-amber-200">
                                              {sb.totalHours} hrs
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: INDIVIDUAL CREW PERFORMANCE */}
            {activeTab === "staff" && (
              <div className="space-y-6 animate-fade-in">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                  <div>
                    <h3 className="font-display text-base font-bold text-slate-900 uppercase tracking-wider">
                      Media Ministry Crew Attendance Roster
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Individual performance stats, total shifts served, and last active timestamp
                    </p>
                  </div>
                  <button
                    onClick={exportStaffCSV}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-amber-900 bg-amber-50 border border-amber-300 hover:bg-amber-100 rounded-lg transition-all shadow-xs cursor-pointer w-fit"
                  >
                    <FileDown className="w-4 h-4 text-amber-700" />
                    Export Staff Summary CSV
                  </button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                    <thead className="bg-slate-100 text-xs font-bold text-slate-700 uppercase tracking-wider">
                      <tr>
                        <th scope="col" className="px-6 py-4">Crew Member</th>
                        <th scope="col" className="px-6 py-4">Total Shifts</th>
                        <th scope="col" className="px-6 py-4">Total Hours Served</th>
                        <th scope="col" className="px-6 py-4">Avg Shift Length</th>
                        <th scope="col" className="px-6 py-4">Last Active Shift</th>
                        <th scope="col" className="px-6 py-4 text-right">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {reportData.staffSummaries.map((s) => {
                        const isStaffExpanded = expandedStaffId === s.userId;
                        return (
                          <React.Fragment key={s.userId}>
                            <tr className="hover:bg-slate-50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="font-bold text-slate-900 text-base">{s.fullName}</div>
                                <div className="text-xs text-slate-500 font-mono">{s.email}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-800">
                                {s.totalShifts} shift(s)
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap font-extrabold text-amber-900 font-sans text-base">
                                {s.totalHours} hrs
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap font-semibold text-slate-700">
                                {s.avgShiftHours} hrs / shift
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-600 font-medium">
                                {s.lastActive ? new Date(s.lastActive).toLocaleDateString("en-US", {
                                  weekday: "short",
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                }) : (
                                  <span className="text-slate-400 italic">No shifts logged</span>
                                )}
                              </td>
                              <td className="px-6 py-4 text-right whitespace-nowrap">
                                <button
                                  onClick={() => setExpandedStaffId(isStaffExpanded ? null : s.userId)}
                                  className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                                    isStaffExpanded
                                      ? "text-amber-900 bg-amber-100 border-amber-300 shadow-xs"
                                      : "text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border-slate-300"
                                  }`}
                                  title={isStaffExpanded ? "Hide Staff Breakdown" : "View Staff Breakdown"}
                                >
                                  {isStaffExpanded ? (
                                    <Eye className="w-3.5 h-3.5 text-amber-700" />
                                  ) : (
                                    <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                                  )}
                                  <span>{isStaffExpanded ? "Hide Stats" : "View Breakdown"}</span>
                                </button>
                              </td>
                            </tr>

                            {/* EXPANDED STAFF DETAIL BREAKDOWN */}
                            {isStaffExpanded && (
                              <tr className="bg-slate-50/80">
                                <td colSpan={6} className="px-6 py-4">
                                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
                                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2 flex items-center justify-between">
                                      <span>Crew Attendance Overview for {s.fullName}</span>
                                      <span className="text-amber-800 font-mono text-[11px] font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                        Total: {s.totalHours} hrs
                                      </span>
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                                        <span className="text-slate-500 text-[10px] uppercase font-bold block mb-1">Shifts Logged</span>
                                        <span className="text-sm font-bold text-slate-900">{s.totalShifts} completed shift(s)</span>
                                      </div>
                                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                                        <span className="text-slate-500 text-[10px] uppercase font-bold block mb-1">Average Duration</span>
                                        <span className="text-sm font-bold text-amber-900">{s.avgShiftHours} hours per shift</span>
                                      </div>
                                      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                                        <span className="text-slate-500 text-[10px] uppercase font-bold block mb-1">Most Recent Activity</span>
                                        <span className="text-sm font-bold text-slate-800">
                                          {s.lastActive ? new Date(s.lastActive).toLocaleString() : "N/A"}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        )}
      </div>

      {/* PRINTABLE REPORT FORMATTER (ONLY VISIBLE WHEN PRINTING) */}
      <div className="hidden print:block p-8 bg-white text-slate-900 space-y-6">
        <div className="text-center border-b-2 border-slate-900 pb-4">
          <h1 className="text-xl font-bold uppercase tracking-wider">World Restoration Center Church</h1>
          <h2 className="text-sm font-semibold uppercase text-slate-700">Media Ministry Official Attendance Report</h2>
          <p className="text-xs text-slate-500 mt-1">Generated on: {new Date().toLocaleDateString()}</p>
        </div>

        {reportData && (
          <div className="space-y-6 text-xs">
            <div className="grid grid-cols-3 gap-4 border p-3 rounded">
              <div><strong>Period:</strong> {reportData.startDate.slice(0, 10)} to {reportData.endDate.slice(0, 10)}</div>
              <div><strong>Total Hours:</strong> {reportData.overallMetrics.totalHours}h</div>
              <div><strong>Total Shifts:</strong> {reportData.overallMetrics.totalShifts}</div>
            </div>

            <div>
              <h3 className="font-bold uppercase border-b pb-1 mb-2">Weekly Summary Breakdown</h3>
              <table className="w-full text-left border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border p-2">Week Period</th>
                    <th className="border p-2">Active Crew</th>
                    <th className="border p-2">Shifts</th>
                    <th className="border p-2">Total Hours</th>
                    <th className="border p-2">Avg Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.weeklySummaries.map((w) => (
                    <tr key={w.weekKey}>
                      <td className="border p-2 font-bold">{w.weekLabel}</td>
                      <td className="border p-2">{w.activeStaffCount}</td>
                      <td className="border p-2">{w.shiftCount}</td>
                      <td className="border p-2 font-bold">{w.totalHours} hrs</td>
                      <td className="border p-2">{w.avgHoursPerShift} hrs</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <h3 className="font-bold uppercase border-b pb-1 mb-2">Staff Roster Attendance Summary</h3>
              <table className="w-full text-left border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border p-2">Crew Member</th>
                    <th className="border p-2">Shifts Logged</th>
                    <th className="border p-2">Total Hours</th>
                    <th className="border p-2">Avg Shift Length</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.staffSummaries.map((s) => (
                    <tr key={s.userId}>
                      <td className="border p-2 font-bold">{s.fullName}</td>
                      <td className="border p-2">{s.totalShifts}</td>
                      <td className="border p-2 font-bold">{s.totalHours} hrs</td>
                      <td className="border p-2">{s.avgShiftHours} hrs</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-12 flex justify-between border-t border-slate-300 text-slate-600">
              <div>
                <p className="border-t border-slate-400 pt-1 w-48">Media Director Signature</p>
              </div>
              <div>
                <p className="border-t border-slate-400 pt-1 w-48">Administrator Approval</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
