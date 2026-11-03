import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { api } from '../services/api.ts';
import {
  Settings,
  Building,
  DollarSign,
  Download,
  CheckCircle2,
  AlertCircle,
  Database,
  Code,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [treatmentPrices, setTreatmentPrices] = useState<any[]>([]);
  const [testPrices, setTestPrices] = useState<any[]>([]);

  const [clinicName, setClinicName] = useState('');
  const [clinicAddress, setClinicAddress] = useState('');
  const [clinicPhone, setClinicPhone] = useState('');
  const [currency, setCurrency] = useState('BDT (৳)');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await api.getSettings();
      setSettings(data);
      setClinicName(data.clinic_name || 'Dhaka Dental Care & Implant Center');
      setClinicAddress(data.clinic_address || 'House 42, Road 11, Banani, Dhaka-1213, Bangladesh');
      setClinicPhone(data.clinic_phone || '+880 2-9876543, +880 1711-234567');
      setCurrency(data.clinic_currency || 'BDT (৳)');

      if (data.default_treatment_prices) {
        try {
          setTreatmentPrices(JSON.parse(data.default_treatment_prices));
        } catch {}
      }
      if (data.default_test_prices) {
        try {
          setTestPrices(JSON.parse(data.default_test_prices));
        } catch {}
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveClinicInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateSettings({
        clinic_name: clinicName,
        clinic_address: clinicAddress,
        clinic_phone: clinicPhone,
        clinic_currency: currency,
        default_treatment_prices: treatmentPrices,
        default_test_prices: testPrices,
      });
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2000);
    } catch (err: any) {
      alert(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const isDeveloper = user?.role === 'developer';

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Clinic Settings &amp; Treatment Catalogue</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Configure clinic profile information, default treatment and diagnostic test fees, and technical database administration.
        </p>
      </div>

      {savedMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Clinic settings and pricing catalogues saved successfully!</span>
        </div>
      )}

      {/* Clinic Information Card */}
      <form onSubmit={handleSaveClinicInfo} className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4 text-xs">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-200 font-bold text-slate-900 text-sm">
          <Building className="w-4 h-4 text-teal-600" />
          <span>Clinic Information</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block font-semibold text-slate-700 mb-1">
              Clinic Name *
            </label>
            <input
              type="text"
              required
              value={clinicName}
              onChange={(e) => setClinicName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 font-medium"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Contact Phone Numbers
            </label>
            <input
              type="text"
              value={clinicPhone}
              onChange={(e) => setClinicPhone(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Standard Currency
            </label>
            <input
              type="text"
              disabled
              value={currency}
              className="w-full px-3 py-2 border border-slate-200 bg-slate-50 rounded-lg text-slate-600 font-bold"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block font-semibold text-slate-700 mb-1">
              Clinic Address / Location (Bangladesh)
            </label>
            <input
              type="text"
              value={clinicAddress}
              onChange={(e) => setClinicAddress(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>

        {/* Treatment Catalogue Table */}
        <div className="pt-4 border-t border-slate-200 space-y-2">
          <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block">
            Default Treatment Pricing (BDT ৳)
          </span>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3">Treatment Name</th>
                  <th className="py-2 px-3">Category</th>
                  <th className="py-2 px-3 text-right">Default Cost (৳)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {treatmentPrices.map((tp, idx) => (
                  <tr key={idx}>
                    <td className="py-2 px-3 font-semibold text-slate-900">{tp.name}</td>
                    <td className="py-2 px-3 text-slate-500">{tp.category}</td>
                    <td className="py-2 px-3 text-right">
                      <input
                        type="number"
                        min="0"
                        value={tp.defaultCost}
                        onChange={(e) => {
                          const updated = [...treatmentPrices];
                          updated[idx].defaultCost = parseFloat(e.target.value) || 0;
                          setTreatmentPrices(updated);
                        }}
                        className="w-24 px-2 py-1 text-right font-bold text-slate-900 border border-slate-200 rounded"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Diagnostic Tests Catalogue */}
        <div className="pt-4 border-t border-slate-200 space-y-2">
          <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] block">
            Default Diagnostic Tests &amp; X-ray Pricing (BDT ৳)
          </span>
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3">Test / X-ray Name</th>
                  <th className="py-2 px-3">Category</th>
                  <th className="py-2 px-3 text-right">Default Cost (৳)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {testPrices.map((tp, idx) => (
                  <tr key={idx}>
                    <td className="py-2 px-3 font-semibold text-slate-900">{tp.name}</td>
                    <td className="py-2 px-3">
                      <span className="px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-800 font-bold border border-cyan-200 text-[10px]">
                        {tp.category}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right">
                      <input
                        type="number"
                        min="0"
                        value={tp.defaultCost}
                        onChange={(e) => {
                          const updated = [...testPrices];
                          updated[idx].defaultCost = parseFloat(e.target.value) || 0;
                          setTestPrices(updated);
                        }}
                        className="w-24 px-2 py-1 text-right font-bold text-slate-900 border border-slate-200 rounded"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-200 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Save Settings & Catalogue'}</span>
          </button>
        </div>
      </form>

      {/* Developer Section: Database Backup */}
      {isDeveloper && (
        <div className="bg-purple-950 text-purple-100 p-5 rounded-xl border border-purple-900 space-y-3">
          <div className="flex items-center gap-2">
            <Code className="w-5 h-5 text-purple-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Database Maintenance &amp; Backup (Cloud SQL PostgreSQL)
            </h2>
          </div>
          <p className="text-xs text-purple-200 leading-relaxed">
            Download full structural and relational JSON snapshot of all PostgreSQL tables (Users, Patients, Visits, Treatments, Tests, Payments, Appointments, Audit Logs).
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => api.downloadBackup()}
              className="px-4 py-2 text-xs font-semibold bg-purple-700 hover:bg-purple-600 text-white rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download PostgreSQL JSON Snapshot</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
