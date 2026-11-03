import React from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  CreditCard,
  Clock,
  UserCheck,
  FileSpreadsheet,
  ShieldAlert,
  Settings,
  HelpCircle,
} from 'lucide-react';

interface SidebarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, setCurrentTab }) => {
  const { user } = useAuth();
  if (!user) return null;

  const isSuperAdmin = user.role === 'main_doctor' || user.role === 'developer';

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'patients', label: 'Central Shared Records', icon: Users, badge: 'Shared' },
    { id: 'my-patients', label: 'My Patient Records', icon: UserCheck, badge: 'Own' },
    { id: 'visits', label: 'Clinic Visits', icon: CalendarCheck },
    { id: 'payments', label: 'Payments & Dues', icon: CreditCard },
    { id: 'followups', label: 'Follow-ups', icon: Clock },
    ...(isSuperAdmin
      ? [{ id: 'doctors', label: 'Doctor Accounts', icon: UserCheck }]
      : []),
    { id: 'exports', label: 'CSV Exports', icon: FileSpreadsheet },
    ...(isSuperAdmin
      ? [{ id: 'audit-logs', label: 'Audit Logs', icon: ShieldAlert }]
      : []),
    ...(isSuperAdmin
      ? [{ id: 'settings', label: 'Clinic Settings', icon: Settings }]
      : []),
  ];

  return (
    <aside className="w-full md:w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 border-r border-slate-800">
      <div className="p-4 border-b border-slate-800 hidden md:block">
        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Clinic Portal
        </div>
        <div className="text-sm font-medium text-slate-200 truncate mt-0.5">
          Dhaka Dental Care & Implant
        </div>
      </div>

      <nav className="p-3 space-y-1 overflow-y-auto flex-1">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setCurrentTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                isActive
                  ? 'bg-teal-600 text-white shadow-xs font-semibold'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-slate-800 text-xs text-slate-400 hidden md:block">
        <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60">
          <div className="flex items-center gap-1.5 text-teal-400 font-semibold mb-1">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Shared Patient DB</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            All doctors share one central record per patient. Any doctor can view full history and add visits.
          </p>
        </div>
      </div>
    </aside>
  );
};
