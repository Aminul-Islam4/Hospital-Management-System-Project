import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { Navbar } from './components/Navbar.tsx';
import { Sidebar } from './components/Sidebar.tsx';
import { LoginPage } from './pages/LoginPage.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { PatientsPage } from './pages/PatientsPage.tsx';
import { PatientDetailPage } from './pages/PatientDetailPage.tsx';
import { VisitsPage } from './pages/VisitsPage.tsx';
import { PaymentsPage } from './pages/PaymentsPage.tsx';
import { FollowUpsPage } from './pages/FollowUpsPage.tsx';
import { DoctorsPage } from './pages/DoctorsPage.tsx';
import { ExportsPage } from './pages/ExportsPage.tsx';
import { AuditLogsPage } from './pages/AuditLogsPage.tsx';
import { SettingsPage } from './pages/SettingsPage.tsx';

import { PatientModal } from './components/PatientModal.tsx';
import { NewVisitModal } from './components/NewVisitModal.tsx';
import { RecordPaymentModal } from './components/RecordPaymentModal.tsx';
import { AddTreatmentModal } from './components/AddTreatmentModal.tsx';
import { AddTestModal } from './components/AddTestModal.tsx';
import { DoctorModal } from './components/DoctorModal.tsx';
import { Patient, User } from './types/index.ts';
import { api } from './services/api.ts';
import { Activity } from 'lucide-react';

function AppContent() {
  const { user, loading } = useAuth();

  // Navigation tab
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);

  // Modal states
  const [patientModalOpen, setPatientModalOpen] = useState(false);
  const [patientToEdit, setPatientToEdit] = useState<Patient | null>(null);

  const [visitModalOpen, setVisitModalOpen] = useState(false);
  const [visitDefaultPatient, setVisitDefaultPatient] = useState<Patient | null>(null);

  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentVisit, setPaymentVisit] = useState<any>(null);
  const [paymentInitialMode, setPaymentInitialMode] = useState<'payment' | 'discount'>('payment');

  const [treatmentModalOpen, setTreatmentModalOpen] = useState(false);
  const [treatmentVisitTarget, setTreatmentVisitTarget] = useState<{ id: number; code: string } | null>(null);

  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testVisitTarget, setTestVisitTarget] = useState<{ id: number; code: string } | null>(null);

  const [doctorModalOpen, setDoctorModalOpen] = useState(false);
  const [doctorToEdit, setDoctorToEdit] = useState<User | null>(null);

  // Trigger state refresh key when sub-modals save
  const [refreshKey, setRefreshKey] = useState(0);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-teal-400 gap-3">
        <Activity className="w-10 h-10 animate-spin" />
        <span className="text-sm font-semibold tracking-wide text-slate-300">
          Loading Dental Clinic Portal...
        </span>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const navigateToTab = (tab: string, context?: any) => {
    if (tab === 'patients' && context?.patientId) {
      setSelectedPatientId(context.patientId);
      setCurrentTab('patient-detail');
    } else {
      setCurrentTab(tab);
    }
  };

  const handleOpenPatientDetail = (pId: number) => {
    setSelectedPatientId(pId);
    setCurrentTab('patient-detail');
  };

  const handleOpenNewVisit = (patient?: any) => {
    if (patient && patient.id) {
      setVisitDefaultPatient(patient);
    } else if (currentTab === 'patient-detail' && selectedPatientId) {
      setVisitDefaultPatient({ id: selectedPatientId } as any);
      api.getPatient(selectedPatientId).then(setVisitDefaultPatient).catch(console.error);
    } else {
      setVisitDefaultPatient(null);
    }
    setVisitModalOpen(true);
  };

  const handleOpenRecordPayment = (visit: any, initialMode: 'payment' | 'discount' = 'payment') => {
    setPaymentVisit(visit);
    setPaymentInitialMode(initialMode);
    setPaymentModalOpen(true);
  };

  const handleOpenPaymentForPatient = async (p: Patient) => {
    try {
      const fullProfile = await api.getPatient(p.id);
      const unpaidList = fullProfile.visits.filter(
        (v: any) => parseFloat(v.outstandingDue || '0') > 0.01
      );
      if (unpaidList.length > 0) {
        handleOpenRecordPayment({
          ...unpaidList[0],
          patientId: fullProfile.id,
          patientName: fullProfile.name,
          patientCode: fullProfile.patientId,
          payAllPatientVisits: unpaidList.length > 1,
        });
      } else {
        handleOpenPatientDetail(p.id);
      }
    } catch {
      handleOpenPatientDetail(p.id);
    }
  };

  const handleOpenAddTreatment = (visitId: number, visitCode: string) => {
    setTreatmentVisitTarget({ id: visitId, code: visitCode });
    setTreatmentModalOpen(true);
  };

  const handleOpenAddTest = (visitId: number, visitCode: string) => {
    setTestVisitTarget({ id: visitId, code: visitCode });
    setTestModalOpen(true);
  };

  const handleOpenDoctorModal = (doctor?: User) => {
    setDoctorToEdit(doctor || null);
    setDoctorModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col text-slate-900 font-sans antialiased">
      <Navbar
        onSelectPatient={handleOpenPatientDetail}
        onNavigateHome={() => setCurrentTab('dashboard')}
        onOpenNewVisit={(patient) => handleOpenNewVisit(patient)}
        onOpenPaymentForPatient={handleOpenPaymentForPatient}
      />

      <div className="flex-1 flex flex-col md:flex-row">
        <Sidebar currentTab={currentTab} setCurrentTab={setCurrentTab} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {currentTab === 'dashboard' && (
            <DashboardPage
              key={refreshKey}
              onNavigate={navigateToTab}
              onSelectPatient={handleOpenPatientDetail}
              onOpenPaymentForPatient={handleOpenPaymentForPatient}
              onOpenRecordPayment={handleOpenRecordPayment}
              onOpenNewPatient={() => {
                setPatientToEdit(null);
                setPatientModalOpen(true);
              }}
              onOpenNewVisit={(patient) => handleOpenNewVisit(patient)}
            />
          )}

          {(currentTab === 'patients' || currentTab === 'my-patients') && (
            <PatientsPage
              key={`${currentTab}-${refreshKey}`}
              mode={currentTab === 'my-patients' ? 'own' : 'central'}
              onSelectPatient={handleOpenPatientDetail}
              onOpenNewPatientModal={() => {
                setPatientToEdit(null);
                setPatientModalOpen(true);
              }}
              onOpenNewVisitForPatient={(patient) => handleOpenNewVisit(patient)}
              onOpenPaymentForPatient={handleOpenPaymentForPatient}
            />
          )}

          {currentTab === 'patient-detail' && selectedPatientId && (
            <PatientDetailPage
              key={selectedPatientId}
              patientId={selectedPatientId}
              refreshKey={refreshKey}
              onBack={() => setCurrentTab('patients')}
              onOpenNewVisit={(patient) => handleOpenNewVisit(patient)}
              onOpenRecordPayment={handleOpenRecordPayment}
              onOpenAddTreatment={handleOpenAddTreatment}
              onOpenAddTest={handleOpenAddTest}
              onOpenEditPatient={(p) => {
                setPatientToEdit(p);
                setPatientModalOpen(true);
              }}
            />
          )}

          {currentTab === 'visits' && (
            <VisitsPage
              key={refreshKey}
              onSelectPatient={handleOpenPatientDetail}
              onSelectVisit={(visitId, patientId) => {
                if (patientId) handleOpenPatientDetail(patientId);
              }}
              onOpenNewVisit={() => handleOpenNewVisit()}
              onOpenRecordPayment={handleOpenRecordPayment}
            />
          )}

          {currentTab === 'payments' && (
            <PaymentsPage
              key={refreshKey}
              onSelectPatient={handleOpenPatientDetail}
              onOpenRecordPayment={handleOpenRecordPayment}
            />
          )}

          {currentTab === 'followups' && (
            <FollowUpsPage
              key={refreshKey}
              onSelectPatient={handleOpenPatientDetail}
            />
          )}

          {currentTab === 'doctors' && (
            <DoctorsPage key={refreshKey} onOpenDoctorModal={handleOpenDoctorModal} />
          )}

          {currentTab === 'exports' && <ExportsPage />}

          {currentTab === 'audit-logs' && <AuditLogsPage key={refreshKey} />}

          {currentTab === 'settings' && <SettingsPage key={refreshKey} />}
        </main>
      </div>

      {/* Global Modals */}
      <PatientModal
        isOpen={patientModalOpen}
        onClose={() => setPatientModalOpen(false)}
        patientToEdit={patientToEdit}
        onSaved={(patient) => {
          setRefreshKey((k) => k + 1);
          handleOpenPatientDetail(patient.id);
        }}
      />

      <NewVisitModal
        isOpen={visitModalOpen}
        onClose={() => setVisitModalOpen(false)}
        defaultPatient={visitDefaultPatient}
        onVisitCreated={(v) => {
          setRefreshKey((k) => k + 1);
          if (v.patientId) {
            handleOpenPatientDetail(v.patientId);
          }
        }}
      />

      {paymentVisit && (
        <RecordPaymentModal
          isOpen={paymentModalOpen}
          onClose={() => {
            setPaymentModalOpen(false);
            setPaymentVisit(null);
            setPaymentInitialMode('payment');
          }}
          visit={paymentVisit}
          initialMode={paymentInitialMode}
          onPaymentRecorded={() => {
            setRefreshKey((k) => k + 1);
          }}
        />
      )}

      {treatmentVisitTarget && (
        <AddTreatmentModal
          isOpen={treatmentModalOpen}
          onClose={() => {
            setTreatmentModalOpen(false);
            setTreatmentVisitTarget(null);
          }}
          visitId={treatmentVisitTarget.id}
          visitCode={treatmentVisitTarget.code}
          onAdded={() => {
            setRefreshKey((k) => k + 1);
          }}
        />
      )}

      {testVisitTarget && (
        <AddTestModal
          isOpen={testModalOpen}
          onClose={() => {
            setTestModalOpen(false);
            setTestVisitTarget(null);
          }}
          visitId={testVisitTarget.id}
          visitCode={testVisitTarget.code}
          onAdded={() => {
            setRefreshKey((k) => k + 1);
          }}
        />
      )}

      <DoctorModal
        isOpen={doctorModalOpen}
        onClose={() => {
          setDoctorModalOpen(false);
          setDoctorToEdit(null);
        }}
        doctorToEdit={doctorToEdit}
        onSaved={() => {
          setRefreshKey((k) => k + 1);
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
