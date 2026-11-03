import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../services/api.ts';
import { PatientDetailedProfile, Visit } from '../types/index.ts';
import {
  ArrowLeft,
  CalendarCheck,
  CreditCard,
  UserCheck,
  HeartPulse,
  Stethoscope,
  Radio,
  FileText,
  Clock,
  Phone,
  MapPin,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Edit2,
  Calendar,
  Sparkles,
  ArrowRight,
  AlertCircle,
  Tag,
  Percent,
  History,
  RotateCcw,
  Calculator,
} from 'lucide-react';
import { UndoPaymentConfirmModal, UndoPaymentTarget } from '../components/UndoPaymentConfirmModal.tsx';

interface PatientDetailPageProps {
  patientId: number;
  refreshKey?: number;
  onBack: () => void;
  onOpenNewVisit: (patient?: any) => void;
  onOpenRecordPayment: (visit: any, initialMode?: 'payment' | 'discount') => void;
  onOpenAddTreatment: (visitId: number, visitCode: string) => void;
  onOpenAddTest: (visitId: number, visitCode: string) => void;
  onOpenEditPatient: (patient: any) => void;
}

export const PatientDetailPage: React.FC<PatientDetailPageProps> = ({
  patientId,
  refreshKey,
  onBack,
  onOpenNewVisit,
  onOpenRecordPayment,
  onOpenAddTreatment,
  onOpenAddTest,
  onOpenEditPatient,
}) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<PatientDetailedProfile | null>(null);
  const [activeTab, setActiveTab] = useState<
    'overview' | 'visits' | 'doctors' | 'medical' | 'treatments' | 'tests' | 'payments' | 'notes'
  >('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [undoTargetPayment, setUndoTargetPayment] = useState<UndoPaymentTarget | null>(null);
  const [voidingId, setVoidingId] = useState<number | null>(null);

  useEffect(() => {
    loadPatient(true);
  }, [patientId]);

  useEffect(() => {
    if (refreshKey !== undefined && refreshKey > 0) {
      loadPatient(false);
    }
  }, [refreshKey]);

  const loadPatient = async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const data = await api.getPatient(patientId);
      setProfile(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load patient');
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  const handleVoidPayment = async (paymentId: number) => {
    setVoidingId(paymentId);
    try {
      await api.deletePayment(paymentId);
      setUndoTargetPayment(null);
      await loadPatient(false);
    } catch (err: any) {
      setError(err.message || 'Failed to undo payment installment');
    } finally {
      setVoidingId(null);
    }
  };

  if (loading) {
    return (
      <div className="py-12 text-center text-slate-500 text-sm">
        Loading centralized patient profile...
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="p-6 bg-white rounded-xl border border-red-200 text-center space-y-3">
        <AlertTriangle className="w-8 h-8 text-red-500 mx-auto" />
        <h3 className="font-bold text-slate-900">Failed to load patient record</h3>
        <p className="text-xs text-slate-500">{error || 'Patient not found'}</p>
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-700 cursor-pointer"
        >
          Return to Patients List
        </button>
      </div>
    );
  }

  const isSuperAdmin = user?.role === 'main_doctor' || user?.role === 'developer';

  const latestVisit = profile.visits.length > 0 ? profile.visits[0] : null;
  const latestOutstandingDue = profile.financialSummary.totalOutstandingDue || 0;

  // Filter visits with active outstanding due (consolidated onto latest visit)
  const unpaidVisits = profile.visits.filter(
    (v) => parseFloat(v.outstandingDue || '0') > 0.01
  );

  const tabs = [
    { id: 'overview', label: '1. Overview', icon: FileText },
    {
      id: 'visits',
      label: `2. Visit History (${profile.visits.length})`,
      icon: CalendarCheck,
      badge: latestOutstandingDue > 0 ? `৳${latestOutstandingDue.toLocaleString()} Due` : undefined,
    },
    { id: 'doctors', label: `3. Doctor History (${profile.doctorHistory.length})`, icon: UserCheck },
    { id: 'medical', label: '4. Disease & Medical History', icon: HeartPulse },
    { id: 'treatments', label: `5. Treatment History (${profile.treatments.length})`, icon: Stethoscope },
    { id: 'tests', label: `6. Test & X-ray History (${profile.diagnosticTests.length})`, icon: Radio },
    {
      id: 'payments',
      label: `7. Payment History (${profile.payments.length})`,
      icon: CreditCard,
      badge: latestOutstandingDue > 0 ? `৳${latestOutstandingDue.toLocaleString()} Due` : undefined,
    },
    { id: 'notes', label: `8. Notes & Follow-ups (${profile.appointments.length})`, icon: Clock },
  ];

  // Outstanding Dues Tracker Component (Always shows latest account state)
  const renderDuesTracker = () => {
    if (!latestVisit || latestOutstandingDue <= 0) {
      return (
        <div className="p-4 rounded-xl bg-emerald-50/80 border border-emerald-200 text-emerald-950 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-emerald-900 text-sm">
                All Patient Visits Are Fully Settled
              </span>
              <p className="text-emerald-700">
                This patient has no outstanding dues. All treatment and radiograph expenses are 100% paid.
              </p>
            </div>
          </div>
          <span className="px-3 py-1 bg-white font-extrabold text-emerald-700 rounded-lg border border-emerald-200 shadow-2xs">
            ৳0 Outstanding Balance
          </span>
        </div>
      );
    }

    const vTotal = parseFloat(latestVisit.totalCost || '0');
    const vPaid = parseFloat(latestVisit.amountPaid || '0');
    const vDue = parseFloat(latestVisit.outstandingDue || '0');
    const carried = latestVisit.previousCarriedDue || 0;
    const cumPayable = latestVisit.cumulativePayable ?? carried + vTotal;
    const paidPct = cumPayable > 0 ? Math.min(100, Math.round((vPaid / cumPayable) * 100)) : 100;

    return (
      <div className="bg-gradient-to-r from-amber-500/10 via-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl p-5 shadow-xs space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-amber-200">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs shrink-0">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-slate-900 text-base">
                  Latest Account Settlement &bull; Active Balance Tracker
                </h3>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-200 text-amber-900 uppercase">
                  Latest Visit: {latestVisit.visitId}
                </span>
              </div>
              <p className="text-xs text-amber-950 font-medium mt-0.5">
                Payments are automatically recorded against the latest cumulative patient balance (previous carried-forward due + latest visit charges).
              </p>
            </div>
          </div>

          <div className="text-right bg-white px-3.5 py-1.5 rounded-xl border border-amber-300 shadow-2xs self-start sm:self-auto">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">
              Latest Remaining Due
            </span>
            <span className="text-lg font-black text-amber-800 font-mono">
              ৳{latestOutstandingDue.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Latest Visit Card with Cumulative Formula & Single Record Payment Button */}
        <div className="bg-white p-4 rounded-xl border border-amber-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-extrabold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 text-xs font-mono">
                {latestVisit.visitId} (Latest Visit #{profile.visits.length} of {profile.visits.length})
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Date: <strong>{latestVisit.visitDate}</strong>
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                <Stethoscope className="w-3 h-3 text-teal-600" />
                <span>{latestVisit.doctorName}</span>
              </span>
            </div>

            <div className="text-xs text-slate-800 font-semibold truncate max-w-lg">
              {latestVisit.diagnosis || 'Clinical Visit'}
            </div>

            {/* Verified Multi-Visit Formula Pill */}
            {carried > 0 ? (
              <div className="flex flex-wrap items-center gap-2 text-[11px] bg-amber-50/70 px-3 py-1.5 rounded-lg border border-amber-200 text-slate-700">
                <span>
                  Prev. Carried Due: <strong className="font-mono text-amber-900">৳{carried.toLocaleString()}</strong>
                </span>
                <span>+</span>
                <span>
                  New Charges ({latestVisit.visitId}): <strong className="font-mono text-slate-900">৳{vTotal.toLocaleString()}</strong>
                </span>
                <span>=</span>
                <span>
                  Total Payable: <strong className="font-mono text-slate-900">৳{cumPayable.toLocaleString()}</strong>
                </span>
                <span>&minus;</span>
                <span>
                  Paid in {latestVisit.visitId}: <strong className="font-mono text-emerald-700">৳{vPaid.toLocaleString()}</strong>
                </span>
                <span>=</span>
                <span className="font-extrabold text-amber-900 font-mono">
                  ৳{vDue.toLocaleString()} Remaining Due
                </span>
              </div>
            ) : (
              <div className="space-y-1 max-w-md pt-1">
                <div className="flex justify-between text-[11px] text-slate-600">
                  <span>Paid: <strong className="text-emerald-700">৳{vPaid.toLocaleString()}</strong> ({paidPct}%)</span>
                  <span>Net Bill: <strong>৳{vTotal.toLocaleString()}</strong></span>
                  <span>Remaining Due: <strong className="text-amber-800">৳{vDue.toLocaleString()}</strong></span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden flex border border-slate-200">
                  <div className="bg-emerald-500 h-full" style={{ width: `${paidPct}%` }} />
                  <div className="bg-amber-400 h-full" style={{ width: `${100 - paidPct}%` }} />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() =>
                onOpenRecordPayment({
                  ...latestVisit,
                  patientId: profile.id,
                  patientName: profile.name,
                  patientCode: profile.patientId,
                })
              }
              className="px-4 py-2.5 text-xs font-bold rounded-xl bg-teal-600 hover:bg-teal-700 text-white shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Record payment against latest balance"
            >
              <CreditCard className="w-4 h-4" />
              <span>Record Payment (৳{vDue.toLocaleString()})</span>
            </button>
          </div>
        </div>
      </div>
    );
  };

  // High-Craft Itemized Cost Breakdown (Treatments & Diagnostic Tests)
  const renderItemizedCostBreakdown = () => {
    const treatmentTotal = profile.financialSummary.totalTreatmentExpenses || 0;
    const testTotal = profile.financialSummary.totalTestExpenses || 0;
    const combinedGross = treatmentTotal + testTotal;
    const treatmentSharePct = combinedGross > 0 ? Math.round((treatmentTotal / combinedGross) * 100) : 50;
    const testSharePct = combinedGross > 0 ? 100 - treatmentSharePct : 50;

    return (
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        {/* Executive Header Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 px-6 py-5 text-white">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300 shrink-0">
                  <Stethoscope className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-teal-300 block">
                    Clinical Billing Statement
                  </span>
                  <h3 className="font-extrabold text-white text-base tracking-tight">
                    Itemized Cost Breakdown (Treatments &amp; Diagnostic Tests)
                  </h3>
                </div>
              </div>
              <p className="text-xs text-slate-300 pl-10">
                Complete line-item register of dental procedures, tooth-specific restorations, and diagnostic imaging charges.
              </p>
            </div>

            {/* Top Metric Summary Strip */}
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3 shrink-0">
              <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-xl px-3.5 py-2 text-right">
                <span className="text-[10px] uppercase tracking-wider text-teal-200 block font-semibold">
                  Treatments ({profile.treatments.length})
                </span>
                <span className="text-sm sm:text-base font-extrabold text-white font-mono">
                  ৳{treatmentTotal.toLocaleString()}
                </span>
              </div>
              <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-xl px-3.5 py-2 text-right">
                <span className="text-[10px] uppercase tracking-wider text-cyan-200 block font-semibold">
                  Tests / X-Rays ({profile.diagnosticTests.length})
                </span>
                <span className="text-sm sm:text-base font-extrabold text-white font-mono">
                  ৳{testTotal.toLocaleString()}
                </span>
              </div>
              <div className="bg-teal-500/25 border border-teal-400/40 rounded-xl px-3.5 py-2 text-right">
                <span className="text-[10px] uppercase tracking-wider text-teal-100 block font-semibold">
                  Itemized Total
                </span>
                <span className="text-sm sm:text-base font-black text-teal-200 font-mono">
                  ৳{combinedGross.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Proportional Cost Split Bar */}
          {combinedGross > 0 && (
            <div className="mt-4 pt-3 border-t border-white/10 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-slate-300">
                <span className="flex items-center gap-1.5 font-medium">
                  <span className="w-2 h-2 rounded-full bg-teal-400 inline-block" />
                  Clinical Procedures Share: <strong className="text-white">{treatmentSharePct}%</strong>
                </span>
                <span className="flex items-center gap-1.5 font-medium">
                  Diagnostic Imaging Share: <strong className="text-white">{testSharePct}%</strong>
                  <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-700/80 overflow-hidden flex p-0.5 gap-0.5">
                <div
                  className="bg-gradient-to-r from-teal-500 to-emerald-400 h-full rounded-l-full transition-all duration-500"
                  style={{ width: `${treatmentSharePct}%` }}
                />
                <div
                  className="bg-gradient-to-r from-cyan-400 to-sky-400 h-full rounded-r-full transition-all duration-500"
                  style={{ width: `${testSharePct}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Two Architectural Columns: Clinical Treatments & Diagnostic Tests */}
        <div className="p-5 sm:p-6 bg-slate-50/60 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Column 1: Clinical Treatments & Dental Procedures */}
          <div className="bg-white rounded-xl border border-slate-200 border-t-4 border-t-teal-600 shadow-2xs flex flex-col justify-between overflow-hidden">
            <div>
              <div className="px-4 py-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center">
                    <Stethoscope className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                      Clinical Treatments &amp; Procedures
                    </h4>
                    <span className="text-[11px] text-slate-500">
                      {profile.treatments.length} procedure{profile.treatments.length === 1 ? '' : 's'} performed
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">
                    Category Subtotal
                  </span>
                  <span className="font-extrabold text-teal-800 text-sm font-mono">
                    ৳{treatmentTotal.toLocaleString()}
                  </span>
                </div>
              </div>

              {profile.treatments.length === 0 ? (
                <div className="py-10 px-4 text-center text-slate-400">
                  <Stethoscope className="w-6 h-6 mx-auto text-slate-300 mb-1.5" />
                  <p className="text-xs font-medium text-slate-500">No clinical treatments recorded yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                  {profile.treatments.map((t, idx) => {
                    const costVal = parseFloat(t.cost || '0');
                    const itemPct = treatmentTotal > 0 ? Math.min(100, Math.round((costVal / treatmentTotal) * 100)) : 0;

                    return (
                      <div
                        key={t.id}
                        className="px-4 py-3 hover:bg-teal-50/30 transition-colors flex items-start justify-between gap-3"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <span className="w-6 h-6 rounded-md bg-slate-100 border border-slate-200 text-slate-600 font-mono text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900 text-xs">
                                {t.treatmentName}
                              </span>
                              {t.toothNumber && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200 font-mono font-bold">
                                  Tooth #{t.toothNumber}
                                </span>
                              )}
                              {t.status && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                                  {t.status}
                                </span>
                              )}
                            </div>
                            {t.description && (
                              <p className="text-[11px] text-slate-500 truncate max-w-xs">
                                {t.description}
                              </p>
                            )}
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                              <span className="font-medium text-slate-600">{t.treatmentDate}</span>
                              <span>&middot;</span>
                              <span className="text-teal-700 font-medium">{t.doctorName}</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-extrabold text-slate-900 text-xs sm:text-sm font-mono block">
                            ৳{costVal.toLocaleString()}
                          </span>
                          <div className="w-16 bg-slate-100 h-1 rounded-full overflow-hidden mt-1 ml-auto">
                            <div
                              className="bg-teal-500 h-full rounded-full"
                              style={{ width: `${itemPct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-4 py-2.5 bg-teal-50/60 border-t border-teal-100 flex items-center justify-between text-xs">
              <span className="font-semibold text-teal-900">
                Total Treatments ({profile.treatments.length} item{profile.treatments.length === 1 ? '' : 's'})
              </span>
              <span className="font-extrabold text-teal-900 font-mono text-sm">
                ৳{treatmentTotal.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Column 2: Diagnostic Tests & Radiographs */}
          <div className="bg-white rounded-xl border border-slate-200 border-t-4 border-t-cyan-600 shadow-2xs flex flex-col justify-between overflow-hidden">
            <div>
              <div className="px-4 py-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-cyan-50 border border-cyan-200 text-cyan-700 flex items-center justify-center">
                    <Radio className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                      Diagnostic Tests &amp; Radiographs
                    </h4>
                    <span className="text-[11px] text-slate-500">
                      {profile.diagnosticTests.length} investigation{profile.diagnosticTests.length === 1 ? '' : 's'} recorded
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">
                    Category Subtotal
                  </span>
                  <span className="font-extrabold text-cyan-800 text-sm font-mono">
                    ৳{testTotal.toLocaleString()}
                  </span>
                </div>
              </div>

              {profile.diagnosticTests.length === 0 ? (
                <div className="py-10 px-4 text-center text-slate-400">
                  <Radio className="w-6 h-6 mx-auto text-slate-300 mb-1.5" />
                  <p className="text-xs font-medium text-slate-500">No diagnostic tests or X-rays recorded yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                  {profile.diagnosticTests.map((t, idx) => {
                    const costVal = parseFloat(t.cost || '0');
                    const itemPct = testTotal > 0 ? Math.min(100, Math.round((costVal / testTotal) * 100)) : 0;

                    return (
                      <div
                        key={t.id}
                        className="px-4 py-3 hover:bg-cyan-50/30 transition-colors flex items-start justify-between gap-3"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <span className="w-6 h-6 rounded-md bg-slate-100 border border-slate-200 text-slate-600 font-mono text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900 text-xs">
                                {t.testName}
                              </span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-cyan-50 text-cyan-800 border border-cyan-200 font-bold">
                                {t.category}
                              </span>
                              {t.status && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                                  {t.status}
                                </span>
                              )}
                            </div>
                            {t.description && (
                              <p className="text-[11px] text-slate-500 truncate max-w-xs">
                                {t.description}
                              </p>
                            )}
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                              <span className="font-medium text-slate-600">{t.testDate}</span>
                              <span>&middot;</span>
                              <span className="text-cyan-700 font-medium">{t.doctorName}</span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-extrabold text-slate-900 text-xs sm:text-sm font-mono block">
                            ৳{costVal.toLocaleString()}
                          </span>
                          <div className="w-16 bg-slate-100 h-1 rounded-full overflow-hidden mt-1 ml-auto">
                            <div
                              className="bg-cyan-500 h-full rounded-full"
                              style={{ width: `${itemPct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="px-4 py-2.5 bg-cyan-50/60 border-t border-cyan-100 flex items-center justify-between text-xs">
              <span className="font-semibold text-cyan-900">
                Total Diagnostic Tests ({profile.diagnosticTests.length} item{profile.diagnosticTests.length === 1 ? '' : 's'})
              </span>
              <span className="font-extrabold text-cyan-900 font-mono text-sm">
                ৳{testTotal.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Consolidated Bottom Statement Footer */}
        <div className="px-6 py-4 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-slate-600">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Gross Procedures + Tests</span>
              <strong className="text-slate-800 font-mono text-sm">৳{combinedGross.toLocaleString()}</strong>
            </div>
            {profile.financialSummary.totalDiscounts > 0 && (
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Concessions / Discounts</span>
                <strong className="text-emerald-700 font-mono text-sm">
                  -৳{profile.financialSummary.totalDiscounts.toLocaleString()}
                </strong>
              </div>
            )}
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Net Patient Bill</span>
              <strong className="text-slate-900 font-mono text-sm font-extrabold">
                ৳{profile.financialSummary.totalExpenses.toLocaleString()}
              </strong>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Total Paid</span>
              <strong className="text-emerald-700 font-mono text-sm font-extrabold">
                ৳{profile.financialSummary.totalAmountPaid.toLocaleString()}
              </strong>
            </div>
            <div className="h-7 w-px bg-slate-200" />
            <div className="text-right">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Current Balance</span>
              <strong
                className={`font-mono text-sm font-black ${
                  profile.financialSummary.totalOutstandingDue > 0 ? 'text-amber-800' : 'text-emerald-700'
                }`}
              >
                {profile.financialSummary.totalOutstandingDue > 0
                  ? `৳${profile.financialSummary.totalOutstandingDue.toLocaleString()} Due`
                  : '৳0 (Settled)'}
              </strong>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Back button and patient header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-start gap-4">
          <button
            type="button"
            onClick={onBack}
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-slate-900 transition-colors mt-0.5 cursor-pointer shrink-0"
            title="Back to Patients List"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-sm font-extrabold px-2.5 py-0.5 rounded bg-teal-600 text-white shadow-2xs">
                {profile.patientId}
              </span>
              <h1 className="text-xl font-bold text-slate-900">{profile.name}</h1>
              <span className="text-xs text-slate-600 font-medium">
                ({profile.gender}, {profile.age ? `${profile.age} yrs` : 'Age N/A'})
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-1">
              <span className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <strong className="text-slate-700">{profile.phone}</strong>
                {profile.altPhone && <span>/ {profile.altPhone}</span>}
              </span>
              {profile.address && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{profile.address}</span>
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Registered: {profile.registrationDate}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {latestVisit && latestOutstandingDue > 0 && (
            <button
              type="button"
              onClick={() =>
                onOpenRecordPayment({
                  ...latestVisit,
                  patientId: profile.id,
                  patientName: profile.name,
                  patientCode: profile.patientId,
                })
              }
              className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <CreditCard className="w-4 h-4" />
              <span>
                Record Payment (৳{latestOutstandingDue.toLocaleString()} Due)
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onOpenEditPatient(profile)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5" />
            <span>Edit Profile</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenNewVisit(profile)}
            className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <CalendarCheck className="w-4 h-4" />
            <span>+ Add New Visit</span>
          </button>
        </div>
      </div>

      {/* Financial & Clinical Summary Highlights */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200">
          <span className="text-slate-500 block mb-0.5">Total Visits</span>
          <span className="text-xl font-bold text-slate-900">{profile.stats.totalVisits}</span>
          <span className="text-[11px] text-teal-700 font-medium block mt-0.5">
            {profile.stats.totalDoctorsVisited} doctors visited
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200">
          <span className="text-slate-500 block mb-0.5">Treatment Expenses</span>
          <span className="text-xl font-bold text-slate-900">
            ৳{profile.financialSummary.totalTreatmentExpenses.toLocaleString()}
          </span>
          <span className="text-[11px] text-slate-500 block mt-0.5">All procedures</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200">
          <span className="text-slate-500 block mb-0.5">Test / X-ray Expenses</span>
          <span className="text-xl font-bold text-slate-900">
            ৳{profile.financialSummary.totalTestExpenses.toLocaleString()}
          </span>
          <span className="text-[11px] text-slate-500 block mt-0.5">OPG, IOPA, CBCT</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200">
          <span className="text-slate-500 block mb-0.5">Total Paid</span>
          <span className="text-xl font-bold text-emerald-700">
            ৳{profile.financialSummary.totalAmountPaid.toLocaleString()}
          </span>
          <span className="text-[11px] text-emerald-600 block mt-0.5">Cleared payments</span>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200">
          <span className="text-slate-500 block mb-0.5">Patient-Wide Due</span>
          <span
            className={`text-xl font-extrabold ${
              profile.financialSummary.totalOutstandingDue > 0 ? 'text-amber-800' : 'text-emerald-700'
            }`}
          >
            ৳{profile.financialSummary.totalOutstandingDue.toLocaleString()}
          </span>
          <span className="text-[11px] text-slate-500 block mt-0.5">
            {profile.financialSummary.totalOutstandingDue > 0
              ? `${unpaidVisits.length} unpaid visit(s)`
              : 'All clear'}
          </span>
        </div>
      </div>

      {/* Allergies & Existing Diseases Banner (Only shown if patient has genuine clinical alerts) */}
      {(() => {
        const isActualAlert = (val?: string | null) => {
          if (!val) return false;
          const s = val.trim().toLowerCase();
          return (
            s !== '' &&
            s !== 'none' &&
            s !== 'none reported' &&
            s !== 'none known' &&
            s !== 'no' &&
            s !== 'n/a' &&
            s !== 'nil' &&
            s !== 'no major systemic illness' &&
            s !== 'no major systemic illness reported.' &&
            s !== 'no major systemic illness.' &&
            s !== '-'
          );
        };

        const hasAllergy = isActualAlert(profile.allergies);
        const hasDisease = isActualAlert(profile.existingDiseases);

        if (!hasAllergy && !hasDisease) return null;

        return (
          <div className="p-3 bg-red-50/80 border border-red-200 rounded-xl flex flex-wrap items-center gap-x-6 gap-y-1 text-xs shadow-2xs">
            <div className="flex items-center gap-1.5 font-bold text-red-900">
              <HeartPulse className="w-4 h-4 text-red-600" />
              <span>CLINICAL ALERTS:</span>
            </div>
            {hasAllergy && (
              <span className="text-red-800">
                <strong>Allergies:</strong> {profile.allergies}
              </span>
            )}
            {hasDisease && (
              <span className="text-slate-800">
                <strong>Existing Diseases:</strong> {profile.existingDiseases}
              </span>
            )}
          </div>
        );
      })()}

      {/* TABS HEADER */}
      <div className="border-b border-slate-200 flex overflow-x-auto gap-1 text-xs font-semibold">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-2.5 border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors cursor-pointer ${
                isActive
                  ? 'border-teal-600 text-teal-800 bg-white font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-teal-600' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB CONTENT CONTAINER */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-6">
        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6 text-xs">
            {/* Prominent Active Dues & Payment Tracker */}
            {renderDuesTracker()}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Patient Demographics & Profile Details */}
              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h3 className="font-bold text-slate-900 text-sm border-b border-slate-200 pb-2">
                  Patient Central Profile Information
                </h3>
                <div className="grid grid-cols-2 gap-2 text-slate-700">
                  <div>
                    <span className="text-slate-500 block">Permanent Patient ID:</span>
                    <strong className="text-teal-700 font-bold">{profile.patientId}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Registration Date:</span>
                    <span>{profile.registrationDate}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Full Name:</span>
                    <span className="font-semibold">{profile.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Age &amp; Gender:</span>
                    <span>{profile.age || 'N/A'} yrs, {profile.gender}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Primary Contact:</span>
                    <span className="font-semibold text-slate-900">{profile.phone}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Alternative Phone:</span>
                    <span>{profile.altPhone || 'None'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 block">Address:</span>
                    <span>{profile.address || 'None provided'}</span>
                  </div>
                  {profile.notes &&
                    ![
                      'needs fasting glucose check before surgical extractions.',
                      'routine dental consultation.',
                      'referred by friend. very compliant patient.',
                      'chief complaint of bleeding gums during brushing.',
                      'none',
                      'n/a',
                    ].includes(profile.notes.trim().toLowerCase()) && (
                      <div className="col-span-2">
                        <span className="text-slate-500 block">Additional Notes:</span>
                        <span className="text-slate-800">{profile.notes}</span>
                      </div>
                    )}
                </div>
              </div>

              {/* Financial Breakdown Card */}
              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <h3 className="font-bold text-slate-900 text-sm border-b border-slate-200 pb-2 flex items-center justify-between">
                  <span>Patient Financial Summary</span>
                  <span className="text-xs text-teal-700 font-normal">Bangladeshi Taka (৳)</span>
                </h3>
                <div className="space-y-2 text-slate-700">
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span>Total Treatment Charges:</span>
                    <strong className="text-slate-900">৳{profile.financialSummary.totalTreatmentExpenses.toLocaleString()}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span>Total Diagnostic Test / X-ray Charges:</span>
                    <strong className="text-slate-900">৳{profile.financialSummary.totalTestExpenses.toLocaleString()}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span>Additional Charges:</span>
                    <strong className="text-slate-900">৳{profile.financialSummary.totalAdditionalCharges.toLocaleString()}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span>Discounts:</span>
                    <strong className="text-emerald-700">- ৳{profile.financialSummary.totalDiscounts.toLocaleString()}</strong>
                  </div>
                  <div className="flex justify-between py-1 text-sm font-bold text-slate-900 border-b border-slate-300">
                    <span>Total Patient Cost:</span>
                    <span>৳{profile.financialSummary.totalExpenses.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-1 text-sm font-bold text-emerald-700 border-b border-slate-300">
                    <span>Total Payments Received:</span>
                    <span>৳{profile.financialSummary.totalAmountPaid.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-1 text-base font-extrabold text-amber-700 pt-1">
                    <span>Cumulative Outstanding Due:</span>
                    <span>৳{profile.financialSummary.totalOutstandingDue.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Itemized Cost Breakdown (Treatments & Diagnostic Tests) */}
            {renderItemizedCostBreakdown()}

            {/* Unique Doctors Timeline Overview */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
              <h3 className="font-bold text-slate-900 text-sm mb-3">
                Attending Doctors on Record ({profile.doctorHistory.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {profile.doctorHistory.map((doc) => (
                  <div key={doc.id} className="bg-white p-3 rounded-lg border border-slate-200">
                    <div className="font-bold text-slate-900">{doc.name}</div>
                    <div className="text-[11px] text-teal-700 font-medium">{doc.specialization}</div>
                    <div className="text-[11px] text-slate-500 mt-1">
                      Conducted <strong>{doc.visitCount}</strong> visit{doc.visitCount > 1 ? 's' : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CHRONOLOGICAL VISIT HISTORY (CORE REQUIREMENT) */}
        {activeTab === 'visits' && (
          <div className="space-y-6">

            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Chronological Visit Timeline (Newest First)
                </h3>
                <p className="text-xs text-slate-500">
                  Shared across all clinic doctors. Complete clinical diagnoses, treatments, tests, and payments are visible to any authorized doctor.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenNewVisit(profile)}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Visit</span>
              </button>
            </div>

            {profile.visits.length === 0 ? (
              <div className="py-8 text-center text-slate-400">
                <CalendarCheck className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="font-semibold text-slate-700">No visits recorded yet for this patient.</p>
                <button
                  type="button"
                  onClick={() => onOpenNewVisit(profile)}
                  className="mt-2 text-xs font-bold text-teal-600 hover:underline cursor-pointer"
                >
                  Create the first visit now &rarr;
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {profile.visits.map((v, vIdx) => {
                  const isOwner = user?.id === v.doctorId;
                  const canEdit = isOwner || isSuperAdmin;
                  const isLatest = v.isLatestVisit !== undefined ? v.isLatestVisit : vIdx === 0;
                  const vTotal = parseFloat(v.totalCost || '0');
                  const vPaid = parseFloat(v.amountPaid || '0');
                  const vDue = parseFloat(v.outstandingDue || '0');
                  const prevCarried = v.previousCarriedDue || 0;
                  const cumPayable = v.cumulativePayable !== undefined ? v.cumulativePayable : prevCarried + vTotal;
                  const balAfter = v.balanceAfterVisit !== undefined ? v.balanceAfterVisit : Math.max(0, cumPayable - vPaid);
                  const paidPct = cumPayable > 0 ? Math.min(100, Math.round((vPaid / cumPayable) * 100)) : 100;
                  const visitNumber = profile.visits.length - vIdx;

                  return (
                    <div
                      key={v.id}
                      className={`border-2 rounded-xl overflow-hidden bg-white shadow-xs ${
                        isLatest && vDue > 0 ? 'border-amber-300 ring-1 ring-amber-200' : 'border-slate-200'
                      }`}
                    >
                      {/* Visit Header */}
                      <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="font-extrabold text-xs text-white bg-teal-700 px-2.5 py-0.5 rounded shadow-2xs">
                            Visit #{visitNumber} of {profile.visits.length}
                            {isLatest ? ' (Latest)' : ''}
                          </span>
                          <span className="font-extrabold text-sm text-teal-800 bg-teal-100 px-2.5 py-0.5 rounded border border-teal-300">
                            {v.visitId}
                          </span>
                          <span className="text-xs text-slate-500 font-medium">
                            {v.visitDate} {v.visitTime ? `at ${v.visitTime}` : ''}
                          </span>
                          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-800 px-2 py-0.5 rounded bg-white border border-slate-200">
                            <Stethoscope className="w-3.5 h-3.5 text-teal-600" />
                            <span>Attending Doctor: {v.doctorName}</span>
                          </span>
                        </div>

                        {/* Payment & Permission Actions - RECORD PAYMENT BUTTON ONLY ON LATEST VISIT */}
                        <div className="flex flex-wrap items-center gap-2">
                          {canEdit ? (
                            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              Editable by you ({isOwner ? 'Attending Doctor' : 'Administrator'})
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1">
                              <Lock className="w-3 h-3 text-slate-400" />
                              <span>Read-only (Attended by {v.doctorName})</span>
                            </span>
                          )}

                          {isLatest ? (
                            vDue > 0 ? (
                              <button
                                type="button"
                                onClick={() =>
                                  onOpenRecordPayment({
                                    ...v,
                                    patientId: profile.id,
                                    patientName: profile.name,
                                    patientCode: profile.patientId,
                                  })
                                }
                                className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
                              >
                                <CreditCard className="w-3.5 h-3.5" />
                                <span>Record Payment (৳{vDue.toLocaleString()} Due)</span>
                              </button>
                            ) : (
                              <span className="px-2.5 py-1 text-xs font-semibold rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Settled ({v.payments?.length || 0} receipt{v.payments?.length === 1 ? '' : 's'})</span>
                              </span>
                            )
                          ) : balAfter > 0 ? (
                            <span className="px-2.5 py-1 text-xs font-semibold rounded bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                              <History className="w-3.5 h-3.5 text-amber-600" />
                              <span>৳{balAfter.toLocaleString()} Carried Forward to Next Visit</span>
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 text-xs font-semibold rounded bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Settled ({v.payments?.length || 0} receipt{v.payments?.length === 1 ? '' : 's'})</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Visit Details Body */}
                      <div className="p-5 space-y-4 text-xs">
                        {/* Complaints & Diagnosis */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/60 p-3.5 rounded-lg border border-slate-200">
                          <div>
                            <span className="font-bold text-slate-600 block mb-1">
                              Patient Complaints &amp; Symptoms:
                            </span>
                            <p className="text-slate-800 italic">
                              {v.complaints || 'Routine dental checkup and consultation.'}
                            </p>
                          </div>
                          <div>
                            <span className="font-bold text-slate-600 block mb-1">
                              Clinical Diagnosis:
                            </span>
                            <p className="font-semibold text-slate-900">
                              {v.diagnosis || 'None entered'}
                            </p>
                          </div>
                        </div>

                        {/* Treatments in this Visit */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                              <Stethoscope className="w-3.5 h-3.5 text-teal-600" />
                              Treatments Performed ({v.treatments?.length || 0})
                            </span>
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => onOpenAddTreatment(v.id, v.visitId)}
                                className="text-[11px] font-bold text-teal-600 hover:text-teal-800 flex items-center gap-1 cursor-pointer"
                              >
                                <Plus className="w-3 h-3" /> Add Treatment
                              </button>
                            )}
                          </div>

                          {v.treatments && v.treatments.length > 0 ? (
                            <div className="border border-slate-200 rounded-lg overflow-hidden">
                              <table className="w-full text-left">
                                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                                  <tr>
                                    <th className="py-2 px-3">Treatment</th>
                                    <th className="py-2 px-3">Tooth #</th>
                                    <th className="py-2 px-3">Description</th>
                                    <th className="py-2 px-3 text-right">Cost (৳)</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {v.treatments.map((t) => (
                                    <tr key={t.id}>
                                      <td className="py-2 px-3 font-semibold text-slate-900">{t.treatmentName}</td>
                                      <td className="py-2 px-3 text-slate-600">{t.toothNumber || 'N/A'}</td>
                                      <td className="py-2 px-3 text-slate-500">{t.description || '-'}</td>
                                      <td className="py-2 px-3 text-right font-bold text-slate-900">
                                        ৳{parseFloat(t.cost).toLocaleString()}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="text-slate-400 italic py-1">No treatments recorded.</div>
                          )}
                        </div>

                        {/* Diagnostic Tests & X-rays in this Visit (Mandatory Module) */}
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                              <Radio className="w-3.5 h-3.5 text-cyan-600" />
                              Diagnostic Tests &amp; X-rays ({v.diagnosticTests?.length || 0})
                            </span>
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => onOpenAddTest(v.id, v.visitId)}
                                className="text-[11px] font-bold text-cyan-600 hover:text-cyan-800 flex items-center gap-1 cursor-pointer"
                              >
                                <Plus className="w-3 h-3" /> Add Test / X-ray
                              </button>
                            )}
                          </div>

                          {v.diagnosticTests && v.diagnosticTests.length > 0 ? (
                            <div className="border border-slate-200 rounded-lg overflow-hidden">
                              <table className="w-full text-left">
                                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold">
                                  <tr>
                                    <th className="py-2 px-3">Test / X-ray Name</th>
                                    <th className="py-2 px-3">Category</th>
                                    <th className="py-2 px-3">Findings / Description</th>
                                    <th className="py-2 px-3 text-right">Cost (৳)</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {v.diagnosticTests.map((t) => (
                                    <tr key={t.id}>
                                      <td className="py-2 px-3 font-semibold text-slate-900">{t.testName}</td>
                                      <td className="py-2 px-3">
                                        <span className="px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-800 font-medium border border-cyan-200">
                                          {t.category}
                                        </span>
                                      </td>
                                      <td className="py-2 px-3 text-slate-500">{t.description || '-'}</td>
                                      <td className="py-2 px-3 text-right font-bold text-slate-900">
                                        ৳{parseFloat(t.cost).toLocaleString()}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="text-slate-400 italic py-1">No diagnostic tests or radiographs recorded.</div>
                          )}
                        </div>

                        {/* Financial Ledger for this Visit */}
                        <div className="bg-teal-50/60 p-4 rounded-xl border border-teal-200 space-y-3">
                          <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
                            <div>
                              <span className="text-slate-500 block">Treatment Charges</span>
                              <strong className="text-slate-900 font-bold font-mono">
                                ৳{parseFloat(v.totalTreatmentCost || '0').toLocaleString()}
                              </strong>
                            </div>
                            <div>
                              <span className="text-slate-500 block">Test Charges</span>
                              <strong className="text-slate-900 font-bold font-mono">
                                ৳{parseFloat(v.totalTestCost || '0').toLocaleString()}
                              </strong>
                            </div>
                            <div>
                              <span className="text-slate-500 block">Concession / Discount</span>
                              <strong className="text-emerald-700 font-bold font-mono">
                                {parseFloat(v.discount || '0') > 0 ? `-৳${parseFloat(v.discount || '0').toLocaleString()}` : '৳0'}
                              </strong>
                            </div>
                            <div>
                              <span className="text-slate-500 block">This Visit Net Bill</span>
                              <strong className="text-teal-900 font-extrabold text-sm font-mono">
                                ৳{vTotal.toLocaleString()}
                              </strong>
                            </div>
                            <div>
                              <span className="text-slate-500 block">Paid in Visit ({paidPct}%)</span>
                              <strong className="text-emerald-700 font-bold font-mono">
                                ৳{vPaid.toLocaleString()}
                              </strong>
                            </div>
                            <div>
                              <span className="text-slate-500 block">
                                {isLatest ? 'Latest Remaining Due' : 'Balance After Visit'}
                              </span>
                              {isLatest ? (
                                <strong
                                  className={`font-extrabold font-mono ${
                                    vDue > 0 ? 'text-amber-800' : 'text-emerald-700'
                                  }`}
                                >
                                  ৳{vDue.toLocaleString()} {vDue === 0 ? '(Cleared)' : '(Active Due)'}
                                </strong>
                              ) : (
                                <strong
                                  className={`font-bold font-mono ${
                                    balAfter > 0 ? 'text-amber-800' : 'text-emerald-700'
                                  }`}
                                >
                                  ৳{balAfter.toLocaleString()} {balAfter > 0 ? '(Carried Forward)' : '(Cleared)'}
                                </strong>
                              )}
                            </div>
                          </div>

                          {/* Show multi-visit cumulative formula whenever previousCarriedDue > 0 */}
                          {prevCarried > 0 && (
                            <div className="pt-2.5 border-t border-teal-200/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-700 bg-white/80 px-3 py-2 rounded-lg">
                              <div className="flex items-center gap-1.5 font-bold text-teal-900">
                                <Calculator className="w-3.5 h-3.5 text-teal-600" />
                                <span>Cumulative Visit Formula:</span>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <span>
                                  Prev. Carried Due: <strong className="font-mono text-amber-800">৳{prevCarried.toLocaleString()}</strong>
                                </span>
                                <span>+</span>
                                <span>
                                  {v.visitId} Net Bill: <strong className="font-mono text-slate-900">৳{vTotal.toLocaleString()}</strong>
                                </span>
                                <span>=</span>
                                <span>
                                  Total Payable: <strong className="font-mono text-slate-900">৳{cumPayable.toLocaleString()}</strong>
                                </span>
                                <span>&minus;</span>
                                <span>
                                  Paid in {v.visitId}: <strong className="font-mono text-emerald-700">৳{vPaid.toLocaleString()}</strong>
                                </span>
                                <span>=</span>
                                <strong className="font-mono text-amber-900">
                                  ৳{(isLatest ? vDue : balAfter).toLocaleString()} {isLatest ? 'Remaining Due' : 'Carried Forward'}
                                </strong>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Payments made on this visit */}
                        {v.payments && v.payments.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            <span className="font-bold text-slate-700 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                              <History className="w-3.5 h-3.5 text-teal-600" />
                              Installment Payment History ({v.payments.length} installment{v.payments.length > 1 ? 's' : ''}):
                            </span>
                            <div className="space-y-1">
                              {v.payments.map((p, pIdx) => {
                                const instNum = p.patientInstallmentNumber || p.installmentNumber || v.payments!.length - pIdx;
                                const totalInst = p.patientTotalInstallments || p.totalInstallments || v.payments!.length;
                                return (
                                  <div
                                    key={p.id}
                                    className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] hover:bg-slate-100/70 transition-colors"
                                  >
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-bold px-1.5 py-0.5 rounded text-[10px] bg-teal-100 text-teal-800 border border-teal-200">
                                        Installment #{instNum} of {totalInst}
                                      </span>
                                      <span className="font-bold text-teal-700 font-mono">{p.paymentId}</span>
                                      <span>
                                        - Received{' '}
                                        <strong className="text-emerald-700">+৳{parseFloat(p.amount).toLocaleString()}</strong> via{' '}
                                        <span className="font-semibold text-slate-800">{p.paymentMethod}</span>{' '}
                                        on {p.paymentDate}
                                      </span>
                                      {p.transactionRef && (
                                        <span className="text-slate-500 font-mono">(Trx: {p.transactionRef})</span>
                                      )}
                                      {p.notes && (
                                        <span className="italic text-slate-600">&ldquo;{p.notes}&rdquo;</span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0 flex-wrap">
                                      {p.remainingDueAfter !== undefined && (
                                        <span
                                          className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                            p.remainingDueAfter > 0
                                              ? 'bg-amber-50 text-amber-800 border-amber-200'
                                              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                          }`}
                                        >
                                          Balance After: ৳{p.remainingDueAfter.toLocaleString()}{' '}
                                          {p.remainingDueAfter === 0 ? '(Settled)' : 'Due'}
                                        </span>
                                      )}
                                      <span className="inline-flex items-center gap-1 font-semibold text-teal-800 bg-white px-2 py-0.5 rounded border border-teal-200">
                                        <Stethoscope className="w-3 h-3 text-teal-600" />
                                        <span>{p.receiverName || 'Doctor'}</span>
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setUndoTargetPayment({
                                            id: p.id,
                                            paymentId: p.paymentId,
                                            amount: p.amount,
                                            paymentMethod: p.paymentMethod,
                                            paymentDate: p.paymentDate,
                                            visitCode: v.visitId,
                                            patientName: profile.name,
                                            receiverName: p.receiverName,
                                            installmentNumber: instNum,
                                            totalInstallments: totalInst,
                                            currentDueBeforeUndo: latestOutstandingDue,
                                          })
                                        }
                                        className="px-2 py-0.5 rounded text-[10px] font-semibold text-slate-600 hover:text-rose-700 bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-300 inline-flex items-center gap-1 transition-colors cursor-pointer"
                                        title="Undo / Delete this mistaken payment installment"
                                      >
                                        <RotateCcw className="w-3 h-3" />
                                        <span>Undo</span>
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Next Follow-up & Clinical Notes */}
                        {(v.nextFollowUpDate || v.notes) && (
                          <div className="flex flex-wrap items-center justify-between text-[11px] pt-2 border-t border-slate-100 text-slate-600">
                            {v.nextFollowUpDate && (
                              <span>
                                <strong>Next Follow-up Scheduled:</strong> {v.nextFollowUpDate}
                              </span>
                            )}
                            {v.notes && (
                              <span>
                                <strong>Doctor Notes:</strong> {v.notes}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: DOCTOR HISTORY */}
        {activeTab === 'doctors' && (
          <div className="space-y-4 text-xs">
            <h3 className="font-bold text-slate-900 text-sm">
              Attending Doctor History for Patient {profile.patientId}
            </h3>
            <p className="text-slate-500">
              Shows all doctors who have treated this patient across separate visits, maintaining complete centralized continuity of dental care.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {profile.doctorHistory.map((doc) => (
                <div key={doc.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Stethoscope className="w-5 h-5 text-teal-600" />
                      <div>
                        <div className="font-bold text-slate-900 text-sm">{doc.name}</div>
                        <div className="text-slate-500">{doc.specialization}</div>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-teal-100 text-teal-800 font-extrabold text-xs">
                      {doc.visitCount} Visit{doc.visitCount > 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB 4: DISEASE & MEDICAL HISTORY */}
        {activeTab === 'medical' && (
          <div className="space-y-4 text-xs">
            <h3 className="font-bold text-slate-900 text-sm">
              Permanent Medical &amp; Dental History
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-red-50/70 border border-red-200 rounded-xl space-y-2">
                <span className="font-bold text-red-900 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  Known Drug &amp; Material Allergies
                </span>
                <p className="text-red-950 font-semibold text-sm">
                  {profile.allergies || 'No known allergies reported.'}
                </p>
              </div>

              <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                <span className="font-bold text-amber-900 flex items-center gap-1.5">
                  <HeartPulse className="w-4 h-4 text-amber-600" />
                  Existing Medical Conditions &amp; Diseases
                </span>
                <p className="text-amber-950 font-semibold text-sm">
                  {profile.existingDiseases || 'No systemic diseases noted.'}
                </p>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 col-span-1 md:col-span-2">
                <span className="font-bold text-slate-800 block">General Medical History &amp; Medications</span>
                <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {profile.medicalHistory || 'No additional history recorded.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: TREATMENT HISTORY */}
        {activeTab === 'treatments' && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">
                Consolidated Treatments History ({profile.treatments.length})
              </h3>
              <span className="font-bold text-slate-900 text-xs">
                Total Treatment Expenses: ৳{profile.financialSummary.totalTreatmentExpenses.toLocaleString()}
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Treatment</th>
                    <th className="py-3 px-4">Tooth #</th>
                    <th className="py-3 px-4">Doctor</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4 text-right">Cost (৳)</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {profile.treatments.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 text-slate-600">{t.treatmentDate}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{t.treatmentName}</td>
                      <td className="py-3 px-4 text-slate-700">{t.toothNumber || 'General'}</td>
                      <td className="py-3 px-4 text-teal-800 font-medium">{t.doctorName}</td>
                      <td className="py-3 px-4 text-slate-500 max-w-xs truncate">{t.description || '-'}</td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        ৳{parseFloat(t.cost).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold">
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 6: DIAGNOSTIC TESTS & X-RAYS (MANDATORY MODULE) */}
        {activeTab === 'tests' && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Diagnostic Tests &amp; Radiograph History ({profile.diagnosticTests.length})
                </h3>
                <p className="text-slate-500">
                  Separate tracking of X-rays, OPG, IOPA, and CBCT expenses contributing to visit financials.
                </p>
              </div>
              <span className="font-bold text-cyan-800 text-xs">
                Total Test Charges: ৳{profile.financialSummary.totalTestExpenses.toLocaleString()}
              </span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Investigation Name</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Referring Doctor</th>
                    <th className="py-3 px-4">Findings &amp; Notes</th>
                    <th className="py-3 px-4 text-right">Cost (৳)</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {profile.diagnosticTests.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 text-slate-600">{t.testDate}</td>
                      <td className="py-3 px-4 font-bold text-slate-900">{t.testName}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-cyan-50 text-cyan-800 font-bold border border-cyan-200">
                          {t.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-800 font-medium">{t.doctorName}</td>
                      <td className="py-3 px-4 text-slate-500 max-w-xs truncate">{t.description || '-'}</td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">
                        ৳{parseFloat(t.cost).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-medium border border-slate-200">
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 7: PAYMENT HISTORY */}
        {activeTab === 'payments' && (
          <div className="space-y-6 text-xs">
            {/* 1. Complete Payment & Installment History Ledger */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  Complete Chronological Payment &amp; Dues History Ledger ({profile.payments.length})
                </h3>
                <p className="text-slate-500">
                  Chronological installment receipts, balance due before payment, amount paid, and remaining balance after each transaction.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {latestVisit && latestOutstandingDue > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenRecordPayment({
                        ...latestVisit,
                        patientId: profile.id,
                        patientName: profile.name,
                        patientCode: profile.patientId,
                      })
                    }
                    className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>+ Record Payment (৳{latestOutstandingDue.toLocaleString()} Due)</span>
                  </button>
                )}
                <span className="font-bold text-emerald-800 text-xs bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                  Total Received: ৳{profile.financialSummary.totalAmountPaid.toLocaleString()}
                </span>
              </div>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Receipt &amp; Installment</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Visit &amp; Covered Procedures</th>
                      <th className="py-3 px-4">Method &amp; Ref</th>
                      <th className="py-3 px-4">Received By</th>
                      <th className="py-3 px-4 text-right">Due Before</th>
                      <th className="py-3 px-4 text-right">Paid Now (৳)</th>
                      <th className="py-3 px-4 text-right">Balance After Payment</th>
                      <th className="py-3 px-4 text-center">Undo Mistaken Entry</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {profile.payments.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-slate-400 italic">
                          No payment transactions recorded for this patient yet.
                        </td>
                      </tr>
                    ) : (
                      profile.payments.map((p) => {
                        const matchVisit = profile.visits.find((v) => v.id === p.visitId);
                        const vTreatments =
                          matchVisit?.treatments || profile.treatments.filter((t) => t.visitId === p.visitId);
                        const vTests =
                          matchVisit?.diagnosticTests ||
                          profile.diagnosticTests.filter((t) => t.visitId === p.visitId);
                        const instIndex = p.patientInstallmentNumber || p.installmentNumber || 1;
                        const totalVisitInst = p.patientTotalInstallments || p.totalInstallments || 1;
                        const visitBill = parseFloat(matchVisit?.totalCost || p.visitTotalCost || '0');
                        const visitDisc = parseFloat(matchVisit?.discount || p.visitDiscount || '0');

                        return (
                          <tr key={p.id} className="hover:bg-slate-50/80">
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="font-bold text-teal-700 font-mono">{p.paymentId}</div>
                              <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">
                                  Installment #{instIndex} of {totalVisitInst}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-slate-600 whitespace-nowrap font-medium">
                              {p.paymentDate}
                            </td>
                            <td className="py-3 px-4 max-w-xs">
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="font-bold text-slate-800 font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                  {p.visitCode || matchVisit?.visitId || `Visit #${p.visitId}`}
                                </span>
                                <span className="text-[11px] text-slate-500">
                                  Bill: <strong className="text-slate-800">৳{visitBill.toLocaleString()}</strong>
                                  {visitDisc > 0 && (
                                    <span className="text-emerald-700 ml-1">(-৳{visitDisc.toLocaleString()})</span>
                                  )}
                                </span>
                              </div>
                              {vTreatments.length === 0 && vTests.length === 0 ? (
                                <span className="text-slate-400 italic text-[11px]">General Visit Settlement</span>
                              ) : (
                                <div className="text-[11px] text-slate-600 space-y-0.5">
                                  {vTreatments.map((t) => (
                                    <div key={t.id} className="truncate max-w-[230px] text-teal-900">
                                      • {t.treatmentName} {t.toothNumber ? `(#${t.toothNumber})` : ''} (৳{parseFloat(t.cost).toLocaleString()})
                                    </div>
                                  ))}
                                  {vTests.map((t) => (
                                    <div key={t.id} className="truncate max-w-[230px] text-cyan-900">
                                      • {t.testName} (৳{parseFloat(t.cost).toLocaleString()})
                                    </div>
                                  ))}
                                </div>
                              )}
                              {p.notes && (
                                <div className="text-[11px] italic text-slate-500 mt-1">
                                  Note: &ldquo;{p.notes}&rdquo;
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-semibold border border-slate-200">
                                {p.paymentMethod}
                              </span>
                              {p.transactionRef && (
                                <div className="text-[10px] font-mono text-slate-500 mt-1">
                                  Ref: {p.transactionRef}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-slate-800 font-medium whitespace-nowrap">
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">
                                <Stethoscope className="w-3 h-3 text-teal-600" />
                                <span>{p.receiverName || 'Clinic Doctor'}</span>
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-semibold text-slate-700 whitespace-nowrap">
                              {p.previousDueBefore !== undefined ? `৳${p.previousDueBefore.toLocaleString()}` : '-'}
                            </td>
                            <td className="py-3 px-4 text-right font-extrabold text-emerald-700 text-sm font-mono whitespace-nowrap">
                              +৳{parseFloat(p.amount).toLocaleString()}
                            </td>
                            <td className="py-3 px-4 text-right whitespace-nowrap">
                              {p.cumulativePaidAfter !== undefined && (
                                <div className="text-[11px] text-slate-600">
                                  Cumulative Paid: <strong className="text-emerald-700 font-mono">৳{p.cumulativePaidAfter.toLocaleString()}</strong>
                                </div>
                              )}
                              {p.remainingDueAfter !== undefined && (
                                <div className="mt-0.5">
                                  {p.remainingDueAfter > 0 ? (
                                    <span className="inline-block text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                                      ৳{p.remainingDueAfter.toLocaleString()} Due
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                                      <CheckCircle2 className="w-3 h-3" /> ৳0 Due (Settled)
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-center whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() =>
                                  setUndoTargetPayment({
                                    id: p.id,
                                    paymentId: p.paymentId,
                                    amount: p.amount,
                                    paymentMethod: p.paymentMethod,
                                    paymentDate: p.paymentDate,
                                    visitCode: p.visitCode || matchVisit?.visitId,
                                    patientName: profile.name,
                                    receiverName: p.receiverName,
                                    installmentNumber: instIndex,
                                    totalInstallments: totalVisitInst,
                                    currentDueBeforeUndo: latestOutstandingDue,
                                  })
                                }
                                title="Undo / Delete mistaken payment installment"
                                className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-slate-600 hover:text-rose-700 bg-slate-100 hover:bg-rose-50 border border-slate-200 hover:border-rose-300 inline-flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>Undo</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* 2. Visit-by-Visit Clinical Cost Breakdown Cards (Record Payment button ONLY on Latest Visit) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <Stethoscope className="w-4 h-4 text-teal-600" />
                  Visit-by-Visit Clinical Cost &amp; Running Balance Summary ({profile.visits.length} Visit{profile.visits.length === 1 ? '' : 's'})
                </span>
                <span className="text-slate-500 text-[11px]">
                  Record Payment is active on the latest visit only
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {profile.visits.map((v, vIdx) => {
                  const isLatest = v.isLatestVisit !== undefined ? v.isLatestVisit : vIdx === 0;
                  const vTreatments = v.treatments || profile.treatments.filter((t) => t.visitId === v.id);
                  const vTests = v.diagnosticTests || profile.diagnosticTests.filter((t) => t.visitId === v.id);
                  const due = parseFloat(v.outstandingDue || '0');
                  const paid = parseFloat(v.amountPaid || '0');
                  const total = parseFloat(v.totalCost || '0');
                  const disc = parseFloat(v.discount || '0');
                  const prevCarried = v.previousCarriedDue || 0;
                  const cumPayable = v.cumulativePayable !== undefined ? v.cumulativePayable : prevCarried + total;
                  const balAfter = v.balanceAfterVisit !== undefined ? v.balanceAfterVisit : Math.max(0, cumPayable - paid);

                  return (
                    <div
                      key={v.id}
                      className={`p-3.5 rounded-xl border space-y-2.5 text-xs transition-colors ${
                        isLatest
                          ? 'bg-teal-50/40 border-teal-300 shadow-2xs'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between border-b border-slate-200/80 pb-2 gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold font-mono text-teal-800 bg-teal-100/80 px-2 py-0.5 rounded border border-teal-200">
                            {v.visitId}
                          </span>
                          {isLatest && (
                            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-teal-700 text-white">
                              Latest Visit
                            </span>
                          )}
                          <span className="text-slate-500 font-medium">{v.visitDate}</span>
                          <span className="text-slate-700 font-semibold truncate max-w-[120px]">&bull; {v.doctorName}</span>
                        </div>

                        {/* Record Payment button ONLY on the latest visit */}
                        {isLatest ? (
                          due > 0 ? (
                            <button
                              type="button"
                              onClick={() =>
                                onOpenRecordPayment({
                                  ...v,
                                  patientId: profile.id,
                                  patientName: profile.name,
                                  patientCode: profile.patientId,
                                })
                              }
                              className="font-extrabold px-2.5 py-1 rounded-lg text-[11px] bg-amber-500 hover:bg-amber-600 text-white shadow-2xs cursor-pointer flex items-center gap-1 shrink-0"
                            >
                              <CreditCard className="w-3 h-3" />
                              <span>Record Payment (৳{due.toLocaleString()})</span>
                            </button>
                          ) : (
                            <span className="font-extrabold px-2 py-0.5 rounded text-[11px] bg-emerald-100 text-emerald-800 shrink-0">
                              Fully Settled
                            </span>
                          )
                        ) : balAfter > 0 ? (
                          <span className="font-bold px-2 py-0.5 rounded text-[10px] bg-amber-100 text-amber-900 border border-amber-200 shrink-0">
                            ৳{balAfter.toLocaleString()} Carried Forward
                          </span>
                        ) : (
                          <span className="font-extrabold px-2 py-0.5 rounded text-[11px] bg-emerald-100 text-emerald-800 shrink-0">
                            Fully Paid
                          </span>
                        )}
                      </div>

                      {/* Cost Breakdown */}
                      <div className="space-y-1.5 divide-y divide-slate-200/60 max-h-40 overflow-y-auto pr-1">
                        {vTreatments.map((t) => (
                          <div key={t.id} className="pt-1 first:pt-0 flex items-center justify-between text-xs">
                            <span className="text-slate-800 font-semibold truncate max-w-[200px]">
                              • {t.treatmentName} {t.toothNumber ? `(Tooth #${t.toothNumber})` : ''}
                            </span>
                            <span className="font-bold text-slate-900 font-mono">৳{parseFloat(t.cost).toLocaleString()}</span>
                          </div>
                        ))}
                        {vTests.map((t) => (
                          <div key={t.id} className="pt-1 flex items-center justify-between text-xs">
                            <span className="text-slate-800 font-semibold truncate max-w-[200px]">
                              • {t.testName} <span className="text-[10px] text-cyan-700">({t.category})</span>
                            </span>
                            <span className="font-bold text-slate-900 font-mono">৳{parseFloat(t.cost).toLocaleString()}</span>
                          </div>
                        ))}
                        {vTreatments.length === 0 && vTests.length === 0 && (
                          <div className="text-slate-400 italic py-1">Clinical consultation visit</div>
                        )}
                      </div>

                      {/* Financial summary for this visit */}
                      <div className="pt-2 border-t border-slate-200 space-y-1 bg-white p-2.5 rounded-lg">
                        {prevCarried > 0 && (
                          <div className="flex items-center justify-between text-[10px] text-amber-800 pb-1 border-b border-slate-100">
                            <span>Prev. Carried Due: <strong>৳{prevCarried.toLocaleString()}</strong> + Visit Bill: <strong>৳{total.toLocaleString()}</strong></span>
                            <span>Payable: <strong className="font-mono">৳{cumPayable.toLocaleString()}</strong></span>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-[11px]">
                          <span>
                            Visit Bill: <strong className="font-mono">৳{total.toLocaleString()}</strong>
                            {disc > 0 && <span className="text-emerald-700 ml-1">(-৳{disc.toLocaleString()})</span>}
                          </span>
                          <span>
                            Paid: <strong className="text-emerald-700 font-mono">৳{paid.toLocaleString()}</strong> ({v.payments?.length || 0} inst.)
                          </span>
                          <span>
                            {isLatest ? (
                              <>
                                Latest Due:{' '}
                                <strong className={`font-mono ${due > 0 ? 'text-amber-800 font-extrabold' : 'text-emerald-700'}`}>
                                  ৳{due.toLocaleString()}
                                </strong>
                              </>
                            ) : (
                              <>
                                After Visit:{' '}
                                <strong className={`font-mono ${balAfter > 0 ? 'text-amber-800' : 'text-slate-600'}`}>
                                  ৳{balAfter.toLocaleString()}
                                </strong>
                              </>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. Itemized Cost Breakdown (Treatments & Diagnostic Tests) */}
            {renderItemizedCostBreakdown()}
          </div>
        )}

        {/* TAB 8: NOTES & FOLLOW-UPS */}
        {activeTab === 'notes' && (
          <div className="space-y-4 text-xs">
            <h3 className="font-bold text-slate-900 text-sm">
              Follow-Up Appointments &amp; Scheduled Reviews
            </h3>

            {profile.appointments.length === 0 ? (
              <p className="text-slate-400 italic py-2">No follow-ups recorded.</p>
            ) : (
              <div className="space-y-2">
                {profile.appointments.map((a) => (
                  <div
                    key={a.id}
                    className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div>
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        <Clock className="w-4 h-4 text-teal-600" />
                        <span>{a.followUpDate}</span>
                        <span className="text-xs text-slate-500 font-normal">
                          (Doctor: {a.doctorName})
                        </span>
                      </div>
                      <p className="text-slate-700 mt-1">{a.reason}</p>
                    </div>

                    <span className="px-2.5 py-1 rounded bg-teal-100 text-teal-800 font-bold border border-teal-200">
                      {a.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Confirmation Popup Modal when Undoing a Mistaken Payment Installment */}
      <UndoPaymentConfirmModal
        isOpen={Boolean(undoTargetPayment)}
        payment={undoTargetPayment}
        isDeleting={voidingId !== null}
        onCancel={() => setUndoTargetPayment(null)}
        onConfirm={handleVoidPayment}
      />
    </div>
  );
};
