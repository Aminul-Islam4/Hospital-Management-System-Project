import React, { useState, useEffect } from 'react';
import { api } from '../services/api.ts';
import {
  DoctorSalary,
  DoctorSalaryMetrics,
  DoctorSalaryType,
  User,
} from '../types/index.ts';
import { formatDateDDMMYYYY } from '../utils/dateFormat.ts';
import {
  Wallet,
  Plus,
  Search,
  Filter,
  RotateCcw,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  Banknote,
  Smartphone,
  Building2,
  Percent,
  Calculator,
  Trash2,
  Edit3,
  Download,
  UserCheck,
  Sparkles,
  X,
  Receipt,
} from 'lucide-react';

export const SalarySheetPage: React.FC = () => {
  const [salaries, setSalaries] = useState<DoctorSalary[]>([]);
  const [doctors, setDoctors] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [doctorFilter, setDoctorFilter] = useState<string>('All');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal State (Add / Edit Salary)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSalary, setEditingSalary] = useState<DoctorSalary | null>(null);

  // Delete confirmation state
  const [deletingSalary, setDeletingSalary] = useState<DoctorSalary | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  // Form Fields
  const [selectedDoctorId, setSelectedDoctorId] = useState<number>(0);
  const [salaryType, setSalaryType] = useState<DoctorSalaryType>('Monthly');
  const [periodLabel, setPeriodLabel] = useState<string>(
    new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })
  );
  const [periodStart, setPeriodStart] = useState<string>(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  );
  const [periodEnd, setPeriodEnd] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [baseAmount, setBaseAmount] = useState<string>('');
  const [daysWorked, setDaysWorked] = useState<string>('1');
  const [commissionBasis, setCommissionBasis] = useState<'collected' | 'billed' | 'custom'>('collected');
  const [commissionSourceAmount, setCommissionSourceAmount] = useState<string>('');
  const [commissionRate, setCommissionRate] = useState<string>('30');
  const [bonusAmount, setBonusAmount] = useState<string>('0');
  const [deductionAmount, setDeductionAmount] = useState<string>('0');
  const [payMode, setPayMode] = useState<'full' | 'partial' | 'pending'>('full');
  const [paidAmount, setPaidAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<
    'Cash' | 'bKash' | 'Nagad' | 'Bank transfer' | 'Other'
  >('Cash');
  const [transactionRef, setTransactionRef] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState<string>('');

  // Live Doctor Metrics for Commission / Daily Helper
  const [doctorMetrics, setDoctorMetrics] = useState<DoctorSalaryMetrics | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getDoctors()
      .then((list) => {
        const docs = list.filter((d) => d.role !== 'developer');
        setDoctors(docs);
        const firstOtherDoc = docs.find((d) => d.role === 'doctor') || docs[0];
        if (firstOtherDoc) {
          setSelectedDoctorId(firstOtherDoc.id);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    loadSalaries();
  }, [doctorFilter, typeFilter, statusFilter, fromDate, toDate]);

  const loadSalaries = async () => {
    setLoading(true);
    try {
      const data = await api.getDoctorSalaries({
        doctorId: doctorFilter,
        salaryType: typeFilter,
        paymentStatus: statusFilter,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      });
      setSalaries(data);
    } catch (err) {
      console.error('Failed to load doctor salaries:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch doctor metrics whenever doctor or period range changes inside the modal
  useEffect(() => {
    if (!isModalOpen || !selectedDoctorId) {
      setDoctorMetrics(null);
      return;
    }
    setLoadingMetrics(true);
    api
      .getDoctorSalaryMetrics({
        doctorId: selectedDoctorId,
        fromDate: periodStart || undefined,
        toDate: periodEnd || undefined,
      })
      .then((metrics) => {
        setDoctorMetrics(metrics);
      })
      .catch(() => setDoctorMetrics(null))
      .finally(() => setLoadingMetrics(false));
  }, [isModalOpen, selectedDoctorId, periodStart, periodEnd]);

  // Filtered salaries by search query
  const displayedSalaries = salaries.filter((s) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.salaryCode.toLowerCase().includes(q) ||
      (s.doctorName || '').toLowerCase().includes(q) ||
      (s.periodLabel || '').toLowerCase().includes(q) ||
      (s.notes || '').toLowerCase().includes(q) ||
      (s.transactionRef || '').toLowerCase().includes(q)
    );
  });

  // Summary KPIs
  const totalPayableSum = displayedSalaries.reduce(
    (sum, s) => sum + (parseFloat(s.totalPayable) || 0),
    0
  );
  const totalPaidSum = displayedSalaries.reduce(
    (sum, s) => sum + (parseFloat(s.paidAmount) || 0),
    0
  );
  const totalDueSum = displayedSalaries.reduce(
    (sum, s) => sum + (parseFloat(s.dueAmount) || 0),
    0
  );
  const monthlySalarySum = displayedSalaries
    .filter((s) => s.salaryType === 'Monthly')
    .reduce((sum, s) => sum + (parseFloat(s.totalPayable) || 0), 0);
  const dailySalarySum = displayedSalaries
    .filter((s) => s.salaryType === 'Daily')
    .reduce((sum, s) => sum + (parseFloat(s.totalPayable) || 0), 0);
  const commissionSalarySum = displayedSalaries
    .filter((s) => s.salaryType === 'Commission')
    .reduce((sum, s) => sum + (parseFloat(s.totalPayable) || 0), 0);

  // Per-Doctor summary breakdown
  const doctorBreakdown = doctors
    .filter((d) => d.role === 'doctor')
    .map((doc) => {
      const docRows = salaries.filter((s) => s.doctorId === doc.id);
      const payable = docRows.reduce((sum, r) => sum + (parseFloat(r.totalPayable) || 0), 0);
      const paid = docRows.reduce((sum, r) => sum + (parseFloat(r.paidAmount) || 0), 0);
      const due = docRows.reduce((sum, r) => sum + (parseFloat(r.dueAmount) || 0), 0);
      return {
        doctor: doc,
        count: docRows.length,
        payable,
        paid,
        due,
      };
    });

  // Live calculation in modal
  const baseNum = Math.max(0, parseFloat(baseAmount) || 0);
  const daysNum = Math.max(1, parseInt(daysWorked, 10) || 1);
  const commSourceNum = Math.max(0, parseFloat(commissionSourceAmount) || 0);
  const commRateNum = Math.max(0, parseFloat(commissionRate) || 0);
  const bonusNum = Math.max(0, parseFloat(bonusAmount) || 0);
  const deductionNum = Math.max(0, parseFloat(deductionAmount) || 0);

  const calculatedCommissionEarned =
    salaryType === 'Commission'
      ? Number(((commSourceNum * commRateNum) / 100).toFixed(2))
      : 0;

  const coreCalculatedAmount =
    salaryType === 'Monthly'
      ? baseNum
      : salaryType === 'Daily'
      ? baseNum * daysNum
      : baseNum + calculatedCommissionEarned;

  const calculatedTotalPayable = Math.max(
    0,
    Number((coreCalculatedAmount + bonusNum - deductionNum).toFixed(2))
  );

  const effectivePaidAmount =
    payMode === 'full'
      ? calculatedTotalPayable
      : payMode === 'pending'
      ? 0
      : Math.max(0, parseFloat(paidAmount) || 0);

  const calculatedDueAmount = Math.max(
    0,
    Number((calculatedTotalPayable - effectivePaidAmount).toFixed(2))
  );

  const openCreateModal = (presetType?: DoctorSalaryType, presetDoctorId?: number) => {
    setEditingSalary(null);
    setFormError(null);
    const otherDocs = doctors.filter((d) => d.role === 'doctor');
    const defaultDoc = presetDoctorId || otherDocs[0]?.id || doctors[0]?.id || 0;
    setSelectedDoctorId(defaultDoc);
    setSalaryType(presetType || 'Monthly');
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split('T')[0];
    const today = now.toISOString().split('T')[0];
    setPeriodStart(firstDay);
    setPeriodEnd(today);
    setPeriodLabel(
      presetType === 'Daily'
        ? `${formatDateDDMMYYYY(today)} Daily Duty`
        : now.toLocaleString('en-US', { month: 'long', year: 'numeric' })
    );
    setBaseAmount('');
    setDaysWorked('1');
    setCommissionBasis('collected');
    setCommissionSourceAmount('');
    setCommissionRate('30');
    setBonusAmount('0');
    setDeductionAmount('0');
    setPayMode('full');
    setPaidAmount('');
    setPaymentMethod('Cash');
    setTransactionRef('');
    setPaymentDate(today);
    setNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (sal: DoctorSalary) => {
    setEditingSalary(sal);
    setFormError(null);
    setSelectedDoctorId(sal.doctorId);
    setSalaryType(sal.salaryType);
    setPeriodLabel(sal.periodLabel);
    setPeriodStart(sal.periodStart || '');
    setPeriodEnd(sal.periodEnd || '');
    setBaseAmount(String(parseFloat(sal.baseAmount) || ''));
    setDaysWorked(String(sal.daysWorked || 1));
    setCommissionBasis((sal.commissionBasis as any) || 'collected');
    setCommissionSourceAmount(String(parseFloat(sal.commissionSourceAmount) || ''));
    setCommissionRate(String(parseFloat(sal.commissionRate) || '30'));
    setBonusAmount(String(parseFloat(sal.bonusAmount) || '0'));
    setDeductionAmount(String(parseFloat(sal.deductionAmount) || '0'));

    const payable = parseFloat(sal.totalPayable) || 0;
    const paid = parseFloat(sal.paidAmount) || 0;
    if (paid >= payable && payable > 0) {
      setPayMode('full');
      setPaidAmount(String(paid));
    } else if (paid === 0) {
      setPayMode('pending');
      setPaidAmount('0');
    } else {
      setPayMode('partial');
      setPaidAmount(String(paid));
    }

    setPaymentMethod(sal.paymentMethod || 'Cash');
    setTransactionRef(sal.transactionRef || '');
    setPaymentDate(sal.paymentDate || new Date().toISOString().split('T')[0]);
    setNotes(sal.notes || '');
    setIsModalOpen(true);
  };

  const handleApplyDoctorMetricToCommission = (
    basis: 'collected' | 'billed',
    amount: number
  ) => {
    setCommissionBasis(basis);
    setCommissionSourceAmount(String(amount));
  };

  const handleSaveSalary = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedDoctorId) {
      setFormError('Please select a doctor.');
      return;
    }
    if (!periodLabel.trim()) {
      setFormError('Please enter a salary period or month label.');
      return;
    }
    if (calculatedTotalPayable <= 0) {
      setFormError('Total payable salary must be greater than ৳0.');
      return;
    }

    setSaving(true);
    try {
      const payload: Partial<DoctorSalary> = {
        doctorId: selectedDoctorId,
        salaryType,
        periodLabel: periodLabel.trim(),
        periodStart: periodStart || null,
        periodEnd: periodEnd || null,
        baseAmount: String(baseNum),
        daysWorked: salaryType === 'Daily' ? daysNum : Number(daysWorked) || 0,
        commissionBasis,
        commissionSourceAmount: String(commSourceNum),
        commissionRate: String(commRateNum),
        bonusAmount: String(bonusNum),
        deductionAmount: String(deductionNum),
        paidAmount: String(effectivePaidAmount),
        paymentMethod,
        transactionRef: transactionRef.trim() || null,
        paymentDate,
        notes: notes.trim() || null,
      };

      if (editingSalary) {
        await api.updateDoctorSalary(editingSalary.id, payload);
      } else {
        await api.createDoctorSalary(payload);
      }

      setIsModalOpen(false);
      await loadSalaries();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save salary entry');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingSalary) return;
    setDeletingLoading(true);
    try {
      await api.deleteDoctorSalary(deletingSalary.id);
      setDeletingSalary(null);
      await loadSalaries();
    } catch (err) {
      console.error('Failed to delete salary:', err);
    } finally {
      setDeletingLoading(false);
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'Salary ID',
      'Payment Date',
      'Doctor Name',
      'Specialization',
      'Salary Type',
      'Period / Month',
      'Base / Rate (BDT)',
      'Days Worked',
      'Commission Source (BDT)',
      'Commission Rate (%)',
      'Commission Earned (BDT)',
      'Bonus (BDT)',
      'Deduction (BDT)',
      'Total Payable (BDT)',
      'Paid Amount (BDT)',
      'Due Amount (BDT)',
      'Status',
      'Payment Method',
      'Transaction Ref',
      'Notes',
    ];

    const rows = displayedSalaries.map((s) => [
      s.salaryCode,
      formatDateDDMMYYYY(s.paymentDate),
      s.doctorName || '',
      s.doctorSpecialization || '',
      s.salaryType,
      s.periodLabel,
      s.baseAmount,
      String(s.daysWorked || 0),
      s.commissionSourceAmount,
      s.commissionRate,
      s.commissionEarned,
      s.bonusAmount,
      s.deductionAmount,
      s.totalPayable,
      s.paidAmount,
      s.dueAmount,
      s.paymentStatus,
      s.paymentMethod,
      s.transactionRef || '',
      (s.notes || '').replace(/"/g, '""'),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((r) => r.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `doctor_salary_sheet_${formatDateDDMMYYYY(new Date().toISOString())}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const hasFilters =
    doctorFilter !== 'All' ||
    typeFilter !== 'All' ||
    statusFilter !== 'All' ||
    fromDate !== '' ||
    toDate !== '' ||
    searchQuery !== '';

  const resetFilters = () => {
    setDoctorFilter('All');
    setTypeFilter('All');
    setStatusFilter('All');
    setFromDate('');
    setToDate('');
    setSearchQuery('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">
              Doctor Salary Sheet &amp; Commission Tracker
            </h1>
            <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200 text-[10px] font-bold uppercase tracking-wider">
              Main Doctor Profile
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Track and manage salaries provided to clinic doctors across Monthly retainers, Daily chamber wages, and Commission-based payouts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl shadow-2xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-teal-600" />
            <span>Export Salary CSV</span>
          </button>

          <button
            type="button"
            onClick={() => openCreateModal('Monthly')}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Record Doctor Salary</span>
          </button>
        </div>
      </div>

      {/* 6 Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
            <Receipt className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] text-slate-500 font-medium block truncate">
              Total Salary Payable
            </span>
            <span className="text-base font-extrabold text-slate-900 block">
              ৳{totalPayableSum.toLocaleString()}
            </span>
            <span className="text-[10px] text-slate-500 font-semibold">
              {displayedSalaries.length} salary record(s)
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] text-slate-500 font-medium block truncate">
              Total Disbursed (Paid)
            </span>
            <span className="text-base font-extrabold text-emerald-700 block">
              ৳{totalPaidSum.toLocaleString()}
            </span>
            <span className="text-[10px] text-emerald-600 font-semibold">
              Cleared payouts
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-rose-200 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] text-slate-500 font-medium block truncate">
              Pending Salary Due
            </span>
            <span className="text-base font-extrabold text-rose-600 block">
              ৳{totalDueSum.toLocaleString()}
            </span>
            <span className="text-[10px] text-rose-600 font-semibold">
              Unpaid doctor balance
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setTypeFilter(typeFilter === 'Monthly' ? 'All' : 'Monthly')}
          className={`text-left bg-white p-4 rounded-xl border shadow-xs flex items-center gap-3 transition-all cursor-pointer ${
            typeFilter === 'Monthly'
              ? 'border-teal-600 ring-2 ring-teal-500/20'
              : 'border-slate-200 hover:border-teal-300'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] text-slate-500 font-medium block truncate">
              Monthly Salaries
            </span>
            <span className="text-base font-extrabold text-slate-900 block">
              ৳{monthlySalarySum.toLocaleString()}
            </span>
            <span className="text-[10px] text-teal-700 font-semibold">
              Fixed monthly model
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setTypeFilter(typeFilter === 'Daily' ? 'All' : 'Daily')}
          className={`text-left bg-white p-4 rounded-xl border shadow-xs flex items-center gap-3 transition-all cursor-pointer ${
            typeFilter === 'Daily'
              ? 'border-blue-600 ring-2 ring-blue-500/20'
              : 'border-slate-200 hover:border-blue-300'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] text-slate-500 font-medium block truncate">
              Daily Basis Wages
            </span>
            <span className="text-base font-extrabold text-slate-900 block">
              ৳{dailySalarySum.toLocaleString()}
            </span>
            <span className="text-[10px] text-blue-700 font-semibold">
              Per-day chamber duty
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setTypeFilter(typeFilter === 'Commission' ? 'All' : 'Commission')}
          className={`text-left bg-white p-4 rounded-xl border shadow-xs flex items-center gap-3 transition-all cursor-pointer ${
            typeFilter === 'Commission'
              ? 'border-purple-600 ring-2 ring-purple-500/20'
              : 'border-slate-200 hover:border-purple-300'
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Percent className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] text-slate-500 font-medium block truncate">
              Commission Payouts
            </span>
            <span className="text-base font-extrabold text-slate-900 block">
              ৳{commissionSalarySum.toLocaleString()}
            </span>
            <span className="text-[10px] text-purple-700 font-semibold">
              % of revenue / treatments
            </span>
          </div>
        </button>
      </div>

      {/* Per-Doctor Quick Salary Summary Cards */}
      {doctorBreakdown.length > 0 && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
              <UserCheck className="w-4 h-4 text-teal-600" />
              <span>Clinic Doctors Salary &amp; Commission Ledger</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => openCreateModal('Monthly')}
                className="px-2.5 py-1 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-[11px] font-bold cursor-pointer"
              >
                + Monthly Salary
              </button>
              <button
                type="button"
                onClick={() => openCreateModal('Daily')}
                className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-[11px] font-bold cursor-pointer"
              >
                + Daily Wage
              </button>
              <button
                type="button"
                onClick={() => openCreateModal('Commission')}
                className="px-2.5 py-1 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 text-[11px] font-bold cursor-pointer"
              >
                + Commission Payout
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {doctorBreakdown.map(({ doctor, count, payable, paid, due }) => {
              const isSelected = String(doctorFilter) === String(doctor.id);
              return (
                <div
                  key={doctor.id}
                  className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-2.5 ${
                    isSelected
                      ? 'bg-teal-50/50 border-teal-500 ring-1 ring-teal-500/30'
                      : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <button
                        type="button"
                        onClick={() =>
                          setDoctorFilter(isSelected ? 'All' : String(doctor.id))
                        }
                        className="font-bold text-slate-900 hover:text-teal-700 text-xs text-left cursor-pointer"
                      >
                        {doctor.fullName}
                      </button>
                      <span className="block text-[11px] text-slate-500">
                        {doctor.specialization || 'Dental Surgeon'}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-bold text-slate-600">
                      {count} slip{count === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-200/80 text-[11px]">
                    <div>
                      <span className="text-slate-400 block">Payable</span>
                      <span className="font-bold text-slate-800">
                        ৳{payable.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Paid</span>
                      <span className="font-bold text-emerald-700">
                        ৳{paid.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Due</span>
                      <span
                        className={`font-bold ${
                          due > 0 ? 'text-rose-600' : 'text-slate-400'
                        }`}
                      >
                        ৳{due.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        setDoctorFilter(isSelected ? 'All' : String(doctor.id))
                      }
                      className="text-[10.5px] font-semibold text-teal-700 hover:underline cursor-pointer"
                    >
                      {isSelected ? 'Showing only this doctor' : 'Filter history'}
                    </button>
                    <button
                      type="button"
                      onClick={() => openCreateModal('Monthly', doctor.id)}
                      className="px-2 py-1 rounded bg-white hover:bg-teal-50 text-teal-800 border border-slate-200 hover:border-teal-300 text-[10.5px] font-bold cursor-pointer"
                    >
                      + Pay Salary
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by salary code (SAL-#), doctor, month, or note..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <select
              value={doctorFilter}
              onChange={(e) => setDoctorFilter(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
            >
              <option value="All">All Doctors</option>
              {doctors
                .filter((d) => d.role === 'doctor')
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.fullName}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
            >
              <option value="All">All Salary Models</option>
              <option value="Monthly">Monthly Salary</option>
              <option value="Daily">Daily Wage</option>
              <option value="Commission">Commission-Based</option>
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-lg px-2.5 py-2 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
            >
              <option value="All">All Statuses</option>
              <option value="Paid">Paid</option>
              <option value="Partial">Partial Due</option>
              <option value="Pending">Pending / Unpaid</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              title="From Payment Date"
              className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700"
            />
            <span className="text-slate-400 text-xs">-</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              title="To Payment Date"
              className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white text-slate-700"
            />
          </div>
        </div>

        {hasFilters && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-500">
              Showing <strong>{displayedSalaries.length}</strong> salary record(s)
            </span>
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1 text-red-600 hover:text-red-700 font-semibold cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Salary Sheet Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">
            Loading doctor salary sheet...
          </div>
        ) : displayedSalaries.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Wallet className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">
              No doctor salary records found
            </p>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Record a Monthly salary, Daily chamber wage, or Commission-based payout for any clinic doctor to track disbursements and balances.
            </p>
            <button
              type="button"
              onClick={() => openCreateModal('Monthly')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-xl cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Record First Salary</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Salary ID &amp; Date</th>
                  <th className="py-3 px-4">Doctor</th>
                  <th className="py-3 px-4">Model &amp; Period</th>
                  <th className="py-3 px-4">Calculation Breakdown</th>
                  <th className="py-3 px-4 text-right">Total Payable</th>
                  <th className="py-3 px-4 text-right">Paid &amp; Method</th>
                  <th className="py-3 px-4 text-right">Due</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {displayedSalaries.map((sal) => {
                  const payable = parseFloat(sal.totalPayable) || 0;
                  const paid = parseFloat(sal.paidAmount) || 0;
                  const due = parseFloat(sal.dueAmount) || 0;
                  const base = parseFloat(sal.baseAmount) || 0;
                  const commSource = parseFloat(sal.commissionSourceAmount) || 0;
                  const commRate = parseFloat(sal.commissionRate) || 0;
                  const commEarned = parseFloat(sal.commissionEarned) || 0;
                  const bonus = parseFloat(sal.bonusAmount) || 0;
                  const deduction = parseFloat(sal.deductionAmount) || 0;

                  return (
                    <tr
                      key={sal.id}
                      className="hover:bg-slate-50/90 transition-colors"
                    >
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="font-mono font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                          {sal.salaryCode}
                        </span>
                        <div className="text-[11px] text-slate-600 font-medium mt-1">
                          {formatDateDDMMYYYY(sal.paymentDate)}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">
                          {sal.doctorName}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {sal.doctorSpecialization || 'Dental Surgeon'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              sal.salaryType === 'Monthly'
                                ? 'bg-teal-50 text-teal-800 border-teal-200'
                                : sal.salaryType === 'Daily'
                                ? 'bg-blue-50 text-blue-800 border-blue-200'
                                : 'bg-purple-50 text-purple-800 border-purple-200'
                            }`}
                          >
                            {sal.salaryType}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              sal.paymentStatus === 'Paid'
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                : sal.paymentStatus === 'Partial'
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-rose-50 text-rose-800 border-rose-200'
                            }`}
                          >
                            {sal.paymentStatus}
                          </span>
                        </div>
                        <div className="font-semibold text-slate-800 mt-1">
                          {sal.periodLabel}
                        </div>
                        {(sal.periodStart || sal.periodEnd) && (
                          <div className="text-[10.5px] text-slate-400">
                            {sal.periodStart ? formatDateDDMMYYYY(sal.periodStart) : ''}{' '}
                            {sal.periodEnd ? `→ ${formatDateDDMMYYYY(sal.periodEnd)}` : ''}
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        {sal.salaryType === 'Monthly' && (
                          <div className="text-slate-700">
                            Monthly Base: <strong>৳{base.toLocaleString()}</strong>
                          </div>
                        )}
                        {sal.salaryType === 'Daily' && (
                          <div className="text-slate-700">
                            Rate: <strong>৳{base.toLocaleString()}/day</strong> &times;{' '}
                            <strong>{sal.daysWorked || 1} day(s)</strong>
                          </div>
                        )}
                        {sal.salaryType === 'Commission' && (
                          <div className="space-y-0.5 text-slate-700">
                            <div>
                              Commission: <strong>{commRate}%</strong> of{' '}
                              <strong>৳{commSource.toLocaleString()}</strong> ={' '}
                              <strong className="text-purple-700">
                                ৳{commEarned.toLocaleString()}
                              </strong>
                            </div>
                            {base > 0 && (
                              <div className="text-[11px] text-slate-500">
                                + Fixed Retainer: ৳{base.toLocaleString()}
                              </div>
                            )}
                          </div>
                        )}
                        {(bonus > 0 || deduction > 0) && (
                          <div className="text-[10.5px] text-slate-500 mt-0.5">
                            {bonus > 0 ? `+ Bonus ৳${bonus.toLocaleString()} ` : ''}
                            {deduction > 0
                              ? `• Deduction -৳${deduction.toLocaleString()}`
                              : ''}
                          </div>
                        )}
                        {sal.notes && (
                          <div className="text-[11px] text-slate-500 italic mt-0.5 truncate">
                            &ldquo;{sal.notes}&rdquo;
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <span className="font-extrabold text-slate-900 text-sm">
                          ৳{payable.toLocaleString()}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="font-extrabold text-emerald-700 text-sm">
                          ৳{paid.toLocaleString()}
                        </div>
                        <div className="inline-flex items-center gap-1 text-[10.5px] text-slate-500 mt-0.5">
                          {sal.paymentMethod === 'Cash' ? (
                            <Banknote className="w-3 h-3 text-emerald-600" />
                          ) : sal.paymentMethod === 'bKash' ||
                            sal.paymentMethod === 'Nagad' ? (
                            <Smartphone className="w-3 h-3 text-pink-600" />
                          ) : (
                            <Building2 className="w-3 h-3 text-blue-600" />
                          )}
                          <span>{sal.paymentMethod}</span>
                          {sal.transactionRef && (
                            <span className="font-mono text-[10px] text-slate-400">
                              ({sal.transactionRef})
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        {due > 0 ? (
                          <span className="font-extrabold text-rose-600 text-sm">
                            ৳{due.toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-emerald-700">
                            ৳0 (Cleared)
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(sal)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-800 border border-slate-200 hover:border-teal-300 font-semibold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                            title="Edit or Pay Remaining Salary Due"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>{due > 0 ? 'Pay / Edit' : 'Edit'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingSalary(sal)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete Salary Entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Doctor Salary Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center">
                  <Calculator className="w-5 h-5 text-teal-300" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">
                    {editingSalary
                      ? `Update Doctor Salary (${editingSalary.salaryCode})`
                      : 'Record / Calculate Doctor Salary'}
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Supports Monthly Fixed Retainer, Daily Chamber Wage, or Commission-Based Calculation
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSalary} className="p-6 space-y-4 text-xs max-h-[85vh] overflow-y-auto">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Doctor & Salary Model Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Select Doctor *
                  </label>
                  <select
                    required
                    value={selectedDoctorId}
                    onChange={(e) => setSelectedDoctorId(parseInt(e.target.value, 10))}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold text-slate-900 focus:ring-2 focus:ring-teal-500"
                  >
                    <option value={0} disabled>
                      -- Select Doctor --
                    </option>
                    {doctors.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.fullName} ({doc.role === 'main_doctor' ? 'Main Doctor' : doc.specialization || 'Doctor'})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Salary Model / Basis *
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['Monthly', 'Daily', 'Commission'] as DoctorSalaryType[]).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setSalaryType(type)}
                        className={`py-2 px-2.5 rounded-lg font-bold border text-center transition-all cursor-pointer ${
                          salaryType === type
                            ? type === 'Monthly'
                              ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                              : type === 'Daily'
                              ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                              : 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Period & Date Range */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Salary Month / Period Label *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. November 2026"
                    value={periodLabel}
                    onChange={(e) => setPeriodLabel(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white font-semibold"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700">Period From</label>
                    {periodStart && (
                      <span className="text-[10px] font-mono text-teal-700 font-bold">
                        {formatDateDDMMYYYY(periodStart)}
                      </span>
                    )}
                  </div>
                  <input
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold text-slate-700">Period To</label>
                    {periodEnd && (
                      <span className="text-[10px] font-mono text-teal-700 font-bold">
                        {formatDateDDMMYYYY(periodEnd)}
                      </span>
                    )}
                  </div>
                  <input
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                  />
                </div>
              </div>

              {/* Live Doctor Performance Helper Banner (Auto-loads doctor's visits/collections in period) */}
              {doctorMetrics && (
                <div className="p-3 rounded-xl bg-teal-50/70 border border-teal-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="font-bold text-teal-950 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                      <span>
                        {doctorMetrics.doctorName}&apos;s Clinic Activity in Selected Period:
                      </span>
                    </div>
                    <div className="text-[11px] text-teal-800 flex flex-wrap gap-x-3 gap-y-1">
                      <span>
                        Visits Handled: <strong>{doctorMetrics.visitCount}</strong> ({doctorMetrics.uniqueDaysWorked} active day{doctorMetrics.uniqueDaysWorked === 1 ? '' : 's'})
                      </span>
                      <span>
                        Treatment Bill: <strong>৳{doctorMetrics.totalTreatmentBill.toLocaleString()}</strong>
                      </span>
                      <span>
                        Collected on Visits: <strong>৳{doctorMetrics.totalCollectedForDoctorVisits.toLocaleString()}</strong>
                      </span>
                    </div>
                  </div>

                  {salaryType === 'Commission' && (
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          handleApplyDoctorMetricToCommission(
                            'collected',
                            doctorMetrics.totalCollectedForDoctorVisits
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-purple-50 text-purple-800 border border-purple-300 text-[10.5px] font-bold cursor-pointer"
                      >
                        Use Collected (৳{doctorMetrics.totalCollectedForDoctorVisits.toLocaleString()})
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleApplyDoctorMetricToCommission(
                            'billed',
                            doctorMetrics.totalTreatmentBill
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-white hover:bg-purple-50 text-purple-800 border border-purple-300 text-[10.5px] font-bold cursor-pointer"
                      >
                        Use Treatment Bill (৳{doctorMetrics.totalTreatmentBill.toLocaleString()})
                      </button>
                    </div>
                  )}

                  {salaryType === 'Daily' && doctorMetrics.uniqueDaysWorked > 0 && (
                    <button
                      type="button"
                      onClick={() => setDaysWorked(String(doctorMetrics.uniqueDaysWorked))}
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-blue-50 text-blue-800 border border-blue-300 text-[10.5px] font-bold cursor-pointer"
                    >
                      Use {doctorMetrics.uniqueDaysWorked} Active Day(s)
                    </button>
                  )}
                </div>
              )}

              {/* Dynamic Calculation Inputs by Salary Type */}
              {salaryType === 'Monthly' && (
                <div className="p-4 rounded-xl bg-teal-50/40 border border-teal-200 space-y-3">
                  <div className="font-bold text-teal-900 uppercase tracking-wider text-[11px]">
                    Monthly Salary Calculation
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Monthly Base Salary (৳) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        required
                        placeholder="e.g. 45000"
                        value={baseAmount}
                        onChange={(e) => setBaseAmount(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-bold text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Bonus / Festival Allowance (৳)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={bonusAmount}
                        onChange={(e) => setBonusAmount(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Deduction / Advance Adjusted (৳)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={deductionAmount}
                        onChange={(e) => setDeductionAmount(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {salaryType === 'Daily' && (
                <div className="p-4 rounded-xl bg-blue-50/40 border border-blue-200 space-y-3">
                  <div className="font-bold text-blue-900 uppercase tracking-wider text-[11px]">
                    Daily Wage Calculation (Daily Rate &times; Days Worked)
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Daily Rate (৳ / Day) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        required
                        placeholder="e.g. 2500"
                        value={baseAmount}
                        onChange={(e) => setBaseAmount(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-bold text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Days Worked *
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={daysWorked}
                        onChange={(e) => setDaysWorked(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-bold text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Bonus / Overtime (৳)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={bonusAmount}
                        onChange={(e) => setBonusAmount(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Deduction (৳)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={deductionAmount}
                        onChange={(e) => setDeductionAmount(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {salaryType === 'Commission' && (
                <div className="p-4 rounded-xl bg-purple-50/40 border border-purple-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-purple-900 uppercase tracking-wider text-[11px]">
                      Commission-Based Calculation (% of Doctor&apos;s Revenue / Treatments)
                    </span>
                    <span className="text-[11px] font-bold text-purple-800">
                      Commission Earned: ৳{calculatedCommissionEarned.toLocaleString()}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Revenue / Treatment Volume (৳) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        required
                        placeholder="e.g. 65000"
                        value={commissionSourceAmount}
                        onChange={(e) => setCommissionSourceAmount(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-bold text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Commission Percentage (%) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="any"
                        required
                        placeholder="e.g. 30"
                        value={commissionRate}
                        onChange={(e) => setCommissionRate(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-bold text-purple-800"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Fixed Base Retainer (৳ Opt.)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0 (if pure commission)"
                        value={baseAmount}
                        onChange={(e) => setBaseAmount(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Bonus / Incentive (৳ Opt.)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={bonusAmount}
                        onChange={(e) => setBonusAmount(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Lab / Material Deduction (৳ Opt.)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={deductionAmount}
                        onChange={(e) => setDeductionAmount(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Payment & Disbursement Section */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2.5">
                  <div>
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Net Payable Salary
                    </span>
                    <span className="text-lg font-extrabold text-slate-900">
                      ৳{calculatedTotalPayable.toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {(
                      [
                        { id: 'full', label: 'Pay Full Now' },
                        { id: 'partial', label: 'Partial Payment' },
                        { id: 'pending', label: 'Keep Due (Unpaid)' },
                      ] as const
                    ).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setPayMode(m.id);
                          if (m.id === 'full') {
                            setPaidAmount(String(calculatedTotalPayable));
                          } else if (m.id === 'pending') {
                            setPaidAmount('0');
                          }
                        }}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer ${
                          payMode === m.id
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Amount Paid (৳) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      disabled={payMode !== 'partial'}
                      value={payMode === 'full' ? calculatedTotalPayable : payMode === 'pending' ? 0 : paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-extrabold text-emerald-700 disabled:bg-slate-100"
                    />
                    <span className="text-[10.5px] text-rose-600 font-semibold block mt-0.5">
                      Remaining Due: ৳{calculatedDueAmount.toLocaleString()}
                    </span>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Payment Method *
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as any)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white font-semibold"
                    >
                      <option value="Cash">Cash</option>
                      <option value="bKash">bKash</option>
                      <option value="Nagad">Nagad</option>
                      <option value="Bank transfer">Bank transfer</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-semibold text-slate-700">Payment Date *</label>
                      {paymentDate && (
                        <span className="text-[10px] font-mono font-bold text-teal-700">
                          {formatDateDDMMYYYY(paymentDate)}
                        </span>
                      )}
                    </div>
                    <input
                      type="date"
                      required
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Transaction / Cheque / bKash Ref (Opt.)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. BKX904821 or Bank Ref..."
                      value={transactionRef}
                      onChange={(e) => setTransactionRef(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Remarks / Salary Breakdown Note (Opt.)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 30% commission on RCT cases + base retainer..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {saving
                      ? 'Saving...'
                      : editingSalary
                      ? 'Update Salary Record'
                      : 'Save Salary Record'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingSalary && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 space-y-4 text-xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Delete Salary Entry ({deletingSalary.salaryCode})?
                </h3>
                <p className="text-slate-500 mt-0.5">
                  {deletingSalary.doctorName} &bull; {deletingSalary.periodLabel} (৳
                  {Number(deletingSalary.totalPayable).toLocaleString()})
                </p>
              </div>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Are you sure you want to remove this salary entry from the salary sheet? This action will be logged in the clinic audit trail.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingSalary(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingLoading}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold cursor-pointer disabled:opacity-50"
              >
                {deletingLoading ? 'Deleting...' : 'Yes, Delete Entry'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
