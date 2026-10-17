/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'admin' | 'staff';
  createdAt: string;
}

export interface TimesheetLog {
  id: string;
  userId: string;
  fullName: string;
  arrivalTime: string;
  departureTime: string | null;
  arrivalSignature: string; // Base64 png data URL
  departureSignature: string | null; // Base64 png data URL
  notes: string;
  departureNotes: string | null;
  status: 'active' | 'completed';
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface DashboardStats {
  totalStaff: number;
  activeStaffCount: number;
  totalHoursThisWeek: number;
  totalCompletedTimesheets: number;
}

export interface StaffBreakdownItem {
  userId: string;
  fullName: string;
  shifts: number;
  totalHours: number;
}

export interface WeeklySummary {
  weekKey: string; // e.g. "2026-W30"
  weekLabel: string; // e.g. "Jul 20 - Jul 26, 2026"
  startDate: string;
  endDate: string;
  totalHours: number;
  shiftCount: number;
  activeStaffCount: number;
  avgHoursPerShift: number;
  staffBreakdown: StaffBreakdownItem[];
}

export interface MonthlySummary {
  monthKey: string; // e.g. "2026-07"
  monthLabel: string; // e.g. "July 2026"
  year: number;
  month: number;
  totalHours: number;
  shiftCount: number;
  activeStaffCount: number;
  avgHoursPerShift: number;
  staffBreakdown: StaffBreakdownItem[];
}

export interface DailyTrend {
  date: string; // YYYY-MM-DD
  dateLabel: string; // e.g. "Sat, Jul 25"
  dayOfWeek: string; // e.g. "Sat"
  totalHours: number;
  shiftCount: number;
  uniqueStaffCount: number;
}

export interface DayOfWeekBreakdown {
  day: string; // e.g. "Sunday"
  shortDay: string; // e.g. "Sun"
  totalHours: number;
  shiftCount: number;
  avgHours: number;
}

export interface StaffReportSummary {
  userId: string;
  fullName: string;
  email: string;
  totalShifts: number;
  totalHours: number;
  avgShiftHours: number;
  lastActive: string | null;
}

export interface AttendanceReport {
  period: 'week' | 'month' | 'quarter' | 'year' | 'custom';
  startDate: string;
  endDate: string;
  overallMetrics: {
    totalHours: number;
    totalShifts: number;
    avgShiftDurationHours: number;
    activeStaffCount: number;
    topContributor: {
      fullName: string;
      totalHours: number;
      shifts: number;
    } | null;
  };
  weeklySummaries: WeeklySummary[];
  monthlySummaries: MonthlySummary[];
  dailyTrends: DailyTrend[];
  staffSummaries: StaffReportSummary[];
  dayOfWeekBreakdown: DayOfWeekBreakdown[];
}

