import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../services/api.ts';
import {
  Sliders,
  CheckCircle2,
  ShieldAlert,
  FileText,
  Lock,
  RefreshCw,
} from 'lucide-react';

interface DeveloperFeatureToggleCardProps {
  variant?: 'dark' | 'light';
}

export const DeveloperFeatureToggleCard: React.FC<DeveloperFeatureToggleCardProps> = ({
  variant = 'light',
}) => {
  const { user, prescriptionManagementEnabled, setPrescriptionFeatureEnabled, refreshFeatures } =
    useAuth();
  const [updating, setUpdating] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  // Strictly only render for Developer role
  if (!user || user.role !== 'developer') {
    return null;
  }

  const handleToggle = async () => {
    const nextState = !prescriptionManagementEnabled;
    setUpdating(true);
    setFeedback(null);
    try {
      const res = await api.toggleFeature('prescription_management', nextState);
      setPrescriptionFeatureEnabled(res.prescriptionManagement);
      await refreshFeatures();
      setFeedback({
        type: 'success',
        message: nextState
          ? 'Prescription Management is now ON (Enabled). All doctors now have immediate access.'
          : 'Prescription Management is now OFF (Disabled). All menus, buttons, and prescription APIs are immediately blocked while existing data remains safely preserved.',
      });
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to update feature status.',
      });
    } finally {
      setUpdating(false);
    }
  };

  const isDark = variant === 'dark';

  return (
    <div
      className={`rounded-xl border p-4 sm:p-5 space-y-3 ${
        isDark
          ? 'bg-purple-900/50 border-purple-700/80 text-purple-50'
          : 'bg-white border-purple-200 text-slate-900 shadow-xs'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isDark
                ? 'bg-purple-800 text-purple-200 border border-purple-600'
                : 'bg-purple-100 text-purple-700 border border-purple-200'
            }`}
          >
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                Feature Management
              </h3>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                  isDark
                    ? 'bg-purple-800/80 text-purple-200 border-purple-600'
                    : 'bg-purple-50 text-purple-800 border-purple-200'
                }`}
              >
                Developer Exclusive Control
              </span>
            </div>
            <p className={`text-xs mt-0.5 ${isDark ? 'text-purple-200' : 'text-slate-500'}`}>
              Global runtime module toggle persisted in PostgreSQL. Takes effect immediately across all sessions without restarting.
            </p>
          </div>
        </div>
      </div>

      {/* Feature Row: Prescription Management */}
      <div
        className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
          isDark
            ? 'bg-slate-950/60 border-purple-800'
            : 'bg-slate-50 border-slate-200'
        }`}
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <FileText className={`w-4 h-4 ${isDark ? 'text-teal-300' : 'text-teal-600'}`} />
            <span className={`text-sm font-extrabold ${isDark ? 'text-white' : 'text-slate-900'}`}>
              Prescription Management
            </span>
            <span
              className={`px-2.5 py-0.5 rounded text-[11px] font-extrabold border ${
                prescriptionManagementEnabled
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : 'bg-rose-100 text-rose-800 border-rose-300'
              }`}
            >
              {prescriptionManagementEnabled ? 'ON (Enabled)' : 'OFF (Disabled)'}
            </span>
          </div>

          <p className={`text-xs leading-relaxed max-w-2xl ${isDark ? 'text-purple-200/90' : 'text-slate-600'}`}>
            {prescriptionManagementEnabled
              ? 'Doctors can see Prescription navigation, create & finalize prescriptions inside Patient Profiles and Visits, review Prescription History, create revisions, and generate A4 PDFs.'
              : 'All Prescription menus, Create Prescription buttons, Prescription History tabs, and backend prescription APIs are hidden and blocked. Existing database records remain preserved.'}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 self-start sm:self-center">
          <span className={`text-xs font-bold ${isDark ? 'text-purple-200' : 'text-slate-600'}`}>
            {prescriptionManagementEnabled ? 'Enabled' : 'Disabled'}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={prescriptionManagementEnabled}
            aria-label="Toggle Prescription Management"
            disabled={updating}
            onClick={handleToggle}
            className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-60 ${
              prescriptionManagementEnabled ? 'bg-emerald-500' : 'bg-slate-400'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out flex items-center justify-center ${
                prescriptionManagementEnabled ? 'translate-x-7' : 'translate-x-0'
              }`}
            >
              {updating && <RefreshCw className="w-3 h-3 text-slate-600 animate-spin" />}
            </span>
          </button>
        </div>
      </div>

      {/* Security & Preservation Note */}
      <div
        className={`flex items-center gap-2 text-[11px] ${
          isDark ? 'text-purple-300' : 'text-slate-500'
        }`}
      >
        <Lock className="w-3.5 h-3.5 shrink-0" />
        <span>
          Super Admin (Main Doctor) and Doctor accounts cannot alter this setting. Switching OFF never deletes prescription records.
        </span>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-lg border text-xs font-semibold flex items-center gap-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-red-50 border-red-300 text-red-900'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}
    </div>
  );
};
