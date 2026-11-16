import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../services/api.ts';
import { DeveloperFeatureToggleCard } from '../components/DeveloperFeatureToggleCard.tsx';
import { MedicineDatabaseManager } from '../components/MedicineDatabaseManager.tsx';
import {
  Code,
  Database,
  Download,
  ShieldAlert,
  CheckCircle2,
  UserCheck,
  Mail,
  Phone,
  Award,
  FileText,
} from 'lucide-react';

export const DeveloperProfilePage: React.FC = () => {
  const { user, prescriptionManagementEnabled } = useAuth();
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    if (user?.role === 'developer') {
      api.getDashboardStats().then(setStats).catch(console.error);
    }
  }, [user, prescriptionManagementEnabled]);

  if (!user || user.role !== 'developer') {
    return (
      <div className="bg-white rounded-2xl border border-rose-200 p-8 text-center max-w-xl mx-auto space-y-3">
        <ShieldAlert className="w-10 h-10 text-rose-600 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900">Developer Access Required</h2>
        <p className="text-xs text-slate-600">
          Only the system developer role can access Developer Profile &amp; Feature Management controls. Super Admin and Doctor accounts cannot modify global system feature toggles.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header Card */}
      <div className="bg-gradient-to-r from-purple-950 via-slate-900 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-purple-900">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-purple-700/60 border border-purple-500/50 flex items-center justify-center shrink-0">
              <Code className="w-7 h-7 text-purple-200" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-purple-500/25 text-purple-200 border border-purple-400/40">
                  Developer Profile &amp; System Control
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Active Session
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                {user.fullName}
              </h1>
              <p className="text-xs sm:text-sm text-purple-200 mt-0.5">
                {user.specialization || 'Lead Full Stack & Database Architect'} &bull; @{user.username}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => api.downloadBackup()}
            className="px-4 py-2 text-xs font-semibold bg-purple-700 hover:bg-purple-600 text-white rounded-xl flex items-center gap-2 transition-colors shadow-xs cursor-pointer self-start md:self-auto"
          >
            <Download className="w-4 h-4" />
            <span>Download Full DB Snapshot (JSON)</span>
          </button>
        </div>

        {/* Developer Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-white/10 text-xs">
          <div className="flex items-center gap-2 text-purple-100">
            <UserCheck className="w-4 h-4 text-purple-300 shrink-0" />
            <div>
              <span className="text-[10px] uppercase tracking-wider text-purple-300 block">Role</span>
              <strong>Developer (Full Access)</strong>
            </div>
          </div>
          <div className="flex items-center gap-2 text-purple-100">
            <Mail className="w-4 h-4 text-purple-300 shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] uppercase tracking-wider text-purple-300 block">Email</span>
              <strong className="truncate block">{user.email || 'aymon@dentalcare.com'}</strong>
            </div>
          </div>
          <div className="flex items-center gap-2 text-purple-100">
            <Phone className="w-4 h-4 text-purple-300 shrink-0" />
            <div>
              <span className="text-[10px] uppercase tracking-wider text-purple-300 block">Phone</span>
              <strong>{user.phone || '+880 1819-987654'}</strong>
            </div>
          </div>
          <div className="flex items-center gap-2 text-purple-100">
            <Award className="w-4 h-4 text-purple-300 shrink-0" />
            <div className="min-w-0">
              <span className="text-[10px] uppercase tracking-wider text-purple-300 block">Qualification</span>
              <strong className="truncate block">
                {user.qualifications || 'B.Sc. in CSE'}
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Management Section (Global Developer-Controlled Toggle) */}
      <DeveloperFeatureToggleCard variant="light" />

      {/* PostgreSQL System Overview */}
      {stats?.developerStats && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-purple-600" />
              <h2 className="text-sm font-bold text-slate-900">
                PostgreSQL Cloud SQL Live Record Counts
              </h2>
            </div>
            <span className="text-[11px] font-medium text-slate-500">
              Preserved across all feature toggle transitions
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-slate-500 block">Users / Doctors</span>
              <span className="text-xl font-extrabold text-slate-900 font-mono">
                {stats.developerStats.totalUsers}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-slate-500 block">Treatments</span>
              <span className="text-xl font-extrabold text-slate-900 font-mono">
                {stats.developerStats.totalTreatments}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-slate-500 block">Diagnostic Tests</span>
              <span className="text-xl font-extrabold text-slate-900 font-mono">
                {stats.developerStats.totalDiagnosticTests}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-slate-500 block">Payments</span>
              <span className="text-xl font-extrabold text-slate-900 font-mono">
                {stats.developerStats.totalPayments}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-teal-50 border border-teal-200">
              <span className="text-teal-700 font-semibold flex items-center gap-1">
                <FileText className="w-3 h-3" /> Prescriptions
              </span>
              <span className="text-xl font-extrabold text-teal-900 font-mono">
                {stats.developerStats.totalPrescriptions ?? 0}
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-slate-500 block">Audit Logs</span>
              <span className="text-xl font-extrabold text-slate-900 font-mono">
                {stats.developerStats.totalAuditLogs}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Medicine Database, CSV Import & Catalog Update Management */}
      <MedicineDatabaseManager />
    </div>
  );
};
