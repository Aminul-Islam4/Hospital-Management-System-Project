import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';
import { Appointment } from '../types/index.ts';
import { Clock, CheckCircle2, XCircle, AlertCircle, Phone, Stethoscope } from 'lucide-react';

interface FollowUpsPageProps {
  onSelectPatient?: (patientId: number) => void;
}

export const FollowUpsPage: React.FC<FollowUpsPageProps> = ({ onSelectPatient }) => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [upcomingOnly, setUpcomingOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAppointments();
  }, [statusFilter, upcomingOnly]);

  const fetchAppointments = async () => {
    setLoading(true);
    try {
      const data = await api.getAppointments({
        status: statusFilter !== 'All' ? statusFilter : undefined,
        upcomingOnly,
      });
      setAppointments(data);
    } catch (e) {
      console.error('Failed to load appointments:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (id: number, newStatus: string) => {
    try {
      await api.updateAppointmentStatus(id, { status: newStatus });
      fetchAppointments();
    } catch (e) {
      console.error('Failed to update appointment status:', e);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Patient Follow-up Tracking</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitor scheduled post-treatment evaluations, suture removals, crown trials, and dental reviews.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white font-medium"
          >
            <option value="All">All Statuses</option>
            <option value="Scheduled">Scheduled</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
            <option value="Missed">Missed</option>
          </select>

          <label className="inline-flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-700 select-none">
            <input
              type="checkbox"
              checked={upcomingOnly}
              onChange={(e) => setUpcomingOnly(e.target.checked)}
              className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
            />
            <span>Upcoming Only</span>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full py-8 text-center text-slate-400 text-xs">
            Loading follow-up appointments...
          </div>
        ) : appointments.length > 0 ? (
          appointments.map((a) => {
            const isScheduled = a.status === 'Scheduled';
            return (
              <div
                key={a.id}
                onClick={() => onSelectPatient && onSelectPatient(a.patientId)}
                className="bg-white rounded-xl border border-slate-200 hover:border-teal-300 hover:shadow-md p-4 shadow-xs space-y-3 flex flex-col justify-between cursor-pointer transition-all"
                title="Click anywhere to view patient profile"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                      {a.patientCode}
                    </span>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                        a.status === 'Scheduled'
                          ? 'bg-blue-50 text-blue-700 border-blue-200'
                          : a.status === 'Completed'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}
                    >
                      {a.status}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-bold text-slate-900 text-sm hover:text-teal-700 transition-colors">
                      {a.patientName}
                    </h3>
                    {a.patientPhone && (
                      <div className="flex items-center gap-1 text-slate-500 text-xs mt-0.5">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{a.patientPhone}</span>
                      </div>
                    )}
                  </div>

                  <div className="text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800">
                      <Clock className="w-3.5 h-3.5 text-teal-600" />
                      <span>{a.followUpDate}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <Stethoscope className="w-3.5 h-3.5 text-slate-400" />
                      <span>Doctor: {a.doctorName}</span>
                    </div>
                    <p className="text-slate-700 mt-1 italic">&ldquo;{a.reason}&rdquo;</p>
                  </div>
                </div>

                {/* Status action buttons */}
                {isScheduled && (
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => handleStatusChange(a.id, 'Completed')}
                      className="px-2.5 py-1 text-xs font-semibold rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 flex items-center gap-1 cursor-pointer"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Mark Done</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusChange(a.id, 'Cancelled')}
                      className="px-2 py-1 text-xs font-semibold rounded bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1 cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Cancel</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-10 text-center text-slate-400 text-xs">
            No follow-ups found for the selected filter.
          </div>
        )}
      </div>
    </div>
  );
};
