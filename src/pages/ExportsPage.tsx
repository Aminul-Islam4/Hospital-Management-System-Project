import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../services/api.ts';
import {
  Download,
  Users,
  CalendarCheck,
  CreditCard,
  Radio,
  Stethoscope,
  DatabaseBackup,
  Calendar,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';

export const ExportsPage: React.FC = () => {
  const { user } = useAuth();
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  const applyPreset = (preset: 'all' | 'today' | '7d' | 'month') => {
    setErrorMsg(null);
    if (preset === 'all') {
      setFromDate('');
      setToDate('');
      return;
    }
    if (preset === 'today') {
      setFromDate(todayStr);
      setToDate(todayStr);
      return;
    }
    if (preset === '7d') {
      const start = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0];
      setFromDate(start);
      setToDate(todayStr);
      return;
    }
    if (preset === 'month') {
      const now = new Date();
      const first = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
        .toISOString()
        .split('T')[0];
      setFromDate(first);
      setToDate(todayStr);
    }
  };

  const buildUrlWithDateFilter = (baseEndpoint: string, ignoreDates = false) => {
    if (ignoreDates) return baseEndpoint;
    const params = new URLSearchParams();
    if (fromDate.trim()) params.set('fromDate', fromDate.trim());
    if (toDate.trim()) params.set('toDate', toDate.trim());
    const qs = params.toString();
    return qs ? `${baseEndpoint}?${qs}` : baseEndpoint;
  };

  const getDateSuffix = (ignoreDates = false) => {
    if (ignoreDates || (!fromDate && !toDate)) {
      return `all_${todayStr}`;
    }
    return `${fromDate || 'start'}_to_${toDate || 'today'}`;
  };

  const handleExport = async (
    id: string,
    endpoint: string,
    baseFilename: string,
    ignoreDates = false
  ) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!ignoreDates && fromDate && toDate && fromDate > toDate) {
      setErrorMsg('"From Date" cannot be later than "To Date". Please adjust the date range.');
      return;
    }

    const url = buildUrlWithDateFilter(endpoint, ignoreDates);
    const filename = `${baseFilename}_${getDateSuffix(ignoreDates)}.csv`;
    setDownloadingId(id);
    try {
      await api.downloadCsv(url, filename);
      setSuccessMsg(`Downloaded ${filename} successfully.`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (e: any) {
      setErrorMsg(e.message || 'CSV export failed.');
    } finally {
      setDownloadingId(null);
    }
  };

  const hasDateRange = Boolean(fromDate || toDate);

  const exportItems = [
    {
      id: 'patients',
      title: 'Patient Master Records CSV',
      description:
        'Exports registered patients with Patient ID, phone, registration date, visit counts, treatment expenses, test expenses, total cost, payment received, and due.',
      endpoint: '/api/export/patients.csv',
      baseFilename: 'dental_care_patients',
      icon: Users,
      badge: 'Master DB',
    },
    {
      id: 'visits',
      title: 'Clinic Visits & Encounters CSV',
      description:
        'Exports chronological visits across attending doctors, complaints, diagnoses, treatment charges, test charges, net bill, paid amount, and due.',
      endpoint: '/api/export/visits.csv',
      baseFilename: 'dental_care_visits',
      icon: CalendarCheck,
      badge: 'All Visits',
    },
    {
      id: 'treatments',
      title: 'Itemized Treatments & Procedures CSV',
      description:
        'Exports every performed dental procedure line-item with Visit Code, Patient ID, doctor, tooth number, cost in BDT, status, and clinical notes.',
      endpoint: '/api/export/treatments.csv',
      baseFilename: 'dental_care_treatments',
      icon: Stethoscope,
      badge: 'Procedures',
    },
    {
      id: 'tests',
      title: 'Diagnostic Tests & X-rays Report CSV',
      description:
        'Exports all diagnostic investigations (OPG, IOPA, CBCT, Bite-wing), referring doctors, dates, findings, and costs in BDT.',
      endpoint: '/api/export/diagnostic-tests.csv',
      baseFilename: 'dental_care_tests_xrays',
      icon: Radio,
      badge: 'Radiology',
    },
    {
      id: 'payments',
      title: 'Payments & Receipts Ledger CSV',
      description:
        user?.role === 'doctor'
          ? 'Exports your personally collected payment receipts (PAY-XXXX), payment methods, dates, and amounts.'
          : 'Exports all clinic payment receipts (PAY-XXXX), cash/bKash/Nagad transactions, dates, amounts, and collector doctor names.',
      endpoint: '/api/export/payments.csv',
      baseFilename: 'dental_care_payments',
      icon: CreditCard,
      badge: user?.role === 'doctor' ? 'My Receipts' : 'Financials',
    },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Data Safety &amp; CSV Data Exports</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Download complete clinic backups or date-filtered CSV reports formatted with UTF-8 BOM for Microsoft Excel and Google Sheets.
        </p>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* From Date - To Date Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-teal-600" />
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Export Date Range Filter (From Date &ndash; To Date)
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <button
              type="button"
              onClick={() => applyPreset('all')}
              className={`px-2.5 py-1 rounded-md font-semibold border transition-colors cursor-pointer ${
                !hasDateRange
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              All Time (Complete Data)
            </button>
            <button
              type="button"
              onClick={() => applyPreset('today')}
              className="px-2.5 py-1 rounded-md font-semibold bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 cursor-pointer"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => applyPreset('7d')}
              className="px-2.5 py-1 rounded-md font-semibold bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 cursor-pointer"
            >
              Last 7 Days
            </button>
            <button
              type="button"
              onClick={() => applyPreset('month')}
              className="px-2.5 py-1 rounded-md font-semibold bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 cursor-pointer"
            >
              This Month
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">From Date</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setErrorMsg(null);
              }}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">To Date</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setErrorMsg(null);
              }}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div className="flex items-center justify-between sm:justify-start gap-2">
            {hasDateRange ? (
              <button
                type="button"
                onClick={() => applyPreset('all')}
                className="px-3 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear Dates (Export All)</span>
              </button>
            ) : (
              <span className="text-xs text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-3 py-2 rounded-lg">
                Scope: Complete Data (All Dates Included)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Master Full Backup CSV Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 rounded-2xl p-5 sm:p-6 text-white shadow-md border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300 shrink-0">
              <DatabaseBackup className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-teal-300 block">
                Full Clinic Backup &amp; Data Safety
              </span>
              <h2 className="font-extrabold text-base sm:text-lg text-white">
                Download All Complete Data (Master CSV Archive)
              </h2>
            </div>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed pl-11">
            Downloads a single unified CSV backup containing all Patients, Visits, Itemized Treatments, Diagnostic Tests/X-rays, Payments Ledger, and Follow-Up Appointments
            {hasDateRange
              ? ` filtered from ${fromDate || 'beginning'} to ${toDate || 'today'}.`
              : ' across the entire clinic history.'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0 pl-11 lg:pl-0">
          {hasDateRange && (
            <button
              type="button"
              disabled={downloadingId === 'complete-filtered'}
              onClick={() =>
                handleExport(
                  'complete-filtered',
                  '/api/export/complete-data.csv',
                  'dental_care_complete_backup',
                  false
                )
              }
              className="px-4 py-2.5 text-xs font-bold rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>
                {downloadingId === 'complete-filtered'
                  ? 'Exporting...'
                  : 'Download Filtered Backup CSV'}
              </span>
            </button>
          )}
          <button
            type="button"
            disabled={downloadingId === 'complete-all'}
            onClick={() =>
              handleExport(
                'complete-all',
                '/api/export/complete-data.csv',
                'dental_care_complete_backup',
                true
              )
            }
            className={`px-4 py-2.5 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50 ${
              hasDateRange
                ? 'bg-white/10 hover:bg-white/20 text-white border border-white/25'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>
              {downloadingId === 'complete-all'
                ? 'Preparing Complete CSV...'
                : 'Download 100% Complete Data (All Time)'}
            </span>
          </button>
        </div>
      </div>

      {/* Individual Dataset CSV Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {exportItems.map((item) => {
          const Icon = item.icon;
          const previewFilename = `${item.baseFilename}_${getDateSuffix(false)}.csv`;
          const isBusy = downloadingId === item.id;
          return (
            <div
              key={item.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    {hasDateRange && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">
                        Date Filtered
                      </span>
                    )}
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 uppercase tracking-wider">
                      {item.badge}
                    </span>
                  </div>
                </div>

                <h3 className="font-bold text-slate-900 text-sm">{item.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{item.description}</p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-400 font-mono truncate">{previewFilename}</span>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => handleExport(item.id, item.endpoint, item.baseFilename, false)}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer shrink-0 disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  <span>{isBusy ? 'Exporting...' : 'Download CSV'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
