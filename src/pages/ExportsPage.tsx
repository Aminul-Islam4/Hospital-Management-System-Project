import React from 'react';
import { api } from '../services/api.ts';
import {
  FileSpreadsheet,
  Download,
  Users,
  CalendarCheck,
  CreditCard,
  Radio,
  CheckCircle2,
} from 'lucide-react';

export const ExportsPage: React.FC = () => {
  const exportItems = [
    {
      id: 'patients',
      title: 'Patient Master Records CSV',
      description:
        'Exports all registered patients with Patient ID, contact info, total visits, total treatment/test charges, total paid, and total outstanding dues.',
      endpoint: '/api/export/patients.csv',
      filename: `dental_patients_${new Date().toISOString().split('T')[0]}.csv`,
      icon: Users,
      badge: 'Master DB',
    },
    {
      id: 'visits',
      title: 'Clinic Visits & Encounters CSV',
      description:
        'Exports chronological visits across all doctors, diagnoses, treatment charges, test charges, amounts paid, and visit outstanding dues.',
      endpoint: '/api/export/visits.csv',
      filename: `dental_visits_${new Date().toISOString().split('T')[0]}.csv`,
      icon: CalendarCheck,
      badge: 'All Doctors',
    },
    {
      id: 'payments',
      title: 'Payments & Receipts Ledger CSV',
      description:
        'Exports all payment receipts (PAY-XXXX), cash/bKash/Nagad transactions, dates, amounts, and recipient staff names.',
      endpoint: '/api/export/payments.csv',
      filename: `dental_payments_${new Date().toISOString().split('T')[0]}.csv`,
      icon: CreditCard,
      badge: 'Financials',
    },
    {
      id: 'tests',
      title: 'Diagnostic Tests & X-rays Report CSV',
      description:
        'Exports all diagnostic investigations (OPG, IOPA, CBCT, Bite-wing), referring doctors, dates, findings, and costs in BDT.',
      endpoint: '/api/export/diagnostic-tests.csv',
      filename: `dental_tests_xrays_${new Date().toISOString().split('T')[0]}.csv`,
      icon: Radio,
      badge: 'Radiology',
    },
  ];

  const handleExport = async (endpoint: string, filename: string) => {
    try {
      await api.downloadCsv(endpoint, filename);
    } catch (e: any) {
      alert(e.message || 'Export failed');
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">CSV Data Exports</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Download browser-based CSV exports formatted with UTF-8 BOM for seamless Microsoft Excel and Google Sheets compatibility.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {exportItems.map((item) => {
          const Icon = item.icon;
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
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 uppercase tracking-wider">
                    {item.badge}
                  </span>
                </div>

                <h3 className="font-bold text-slate-900 text-sm">{item.title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{item.description}</p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400 font-mono">{item.filename}</span>
                <button
                  type="button"
                  onClick={() => handleExport(item.endpoint, item.filename)}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download CSV</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
