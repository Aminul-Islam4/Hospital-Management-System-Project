export type UserRole = 'main_doctor' | 'developer' | 'doctor';

export interface User {
  id: number;
  uid?: string | null;
  username: string;
  fullName: string;
  role: UserRole;
  email?: string | null;
  phone?: string | null;
  isActive: boolean;
  specialization?: string | null;
  qualifications?: string | null;
  joiningDate?: string | null;
  totalVisits?: number;
  uniquePatients?: number;
  todayVisits?: number;
}

export interface Patient {
  id: number;
  patientId: string; // e.g. DP-1001
  name: string;
  phone: string;
  altPhone?: string | null;
  age?: number | null;
  gender: 'Male' | 'Female' | 'Other';
  address?: string | null;
  registrationDate: string;
  medicalHistory?: string | null;
  allergies?: string | null;
  existingDiseases?: string | null;
  notes?: string | null;
  createdAt?: string;
  visitCount?: number;
  myVisitCount?: number;
  uniqueDoctorsCount?: number;
  attendedDoctorIds?: number[];
  attendedDoctorNames?: string[];
  createdBy?: number | null;
  lastVisitDate?: string | null;
  nextFollowUpDate?: string | null;
  totalExpenses?: number;
  totalPaid?: number;
  totalDue?: number;
}

export interface Treatment {
  id: number;
  visitId: number;
  patientId?: number;
  doctorId?: number;
  doctorName?: string;
  treatmentName: string;
  description?: string | null;
  toothNumber?: string | null;
  cost: string;
  status: string;
  notes?: string | null;
  treatmentDate: string;
}

export interface DiagnosticTest {
  id: number;
  visitId: number;
  patientId?: number;
  doctorId?: number;
  doctorName?: string;
  testName: string;
  category: 'Dental X-ray' | 'OPG' | 'IOPA' | 'CBCT' | 'Other';
  description?: string | null;
  cost: string;
  status: string;
  notes?: string | null;
  testDate: string;
}

export interface Payment {
  id: number;
  paymentId: string;
  patientId: number;
  patientCode?: string;
  patientName?: string;
  patientPhone?: string;
  visitId: number;
  visitCode?: string;
  amount: string;
  paymentMethod: 'Cash' | 'bKash' | 'Nagad' | 'Bank transfer' | 'Other';
  transactionRef?: string | null;
  notes?: string | null;
  paymentDate: string;
  receivedBy?: number;
  receiverName?: string;
  visitTotalCost?: string;
  visitAmountPaid?: string;
  visitOutstandingDue?: string;
  visitDiscount?: string;
  installmentNumber?: number;
  totalInstallments?: number;
  patientInstallmentNumber?: number;
  patientTotalInstallments?: number;
  cumulativePaidAfter?: number;
  remainingDueAfter?: number;
  previousDueBefore?: number;
  previousCarriedDue?: number;
  createdAt?: string;
}

export interface Appointment {
  id: number;
  patientId: number;
  patientCode?: string;
  patientName?: string;
  patientPhone?: string;
  visitId?: number | null;
  doctorId: number;
  doctorName?: string;
  followUpDate: string;
  reason: string;
  status: 'Scheduled' | 'Completed' | 'Cancelled' | 'Missed';
  notes?: string | null;
}

export interface Visit {
  id: number;
  visitId: string;
  patientId: number;
  patientCode?: string;
  patientName?: string;
  patientPhone?: string;
  patientAge?: number;
  patientGender?: string;
  doctorId: number;
  doctorName: string;
  doctorSpecialization?: string;
  visitDate: string;
  visitTime?: string;
  complaints?: string | null;
  diagnosis?: string | null;
  notes?: string | null;
  nextFollowUpDate?: string | null;
  totalTreatmentCost: string;
  totalTestCost: string;
  additionalCharges: string;
  discount: string;
  totalCost: string;
  amountPaid: string;
  outstandingDue: string;
  previousCarriedDue?: number;
  cumulativePayable?: number;
  balanceAfterVisit?: number;
  isLatestVisit?: boolean;
  status: string;
  visitSequenceNumber?: number;
  patientTotalVisits?: number;
  patientUniqueDoctorsCount?: number;
  createdAt?: string;
  treatments?: Treatment[];
  diagnosticTests?: DiagnosticTest[];
  payments?: Payment[];
}

export interface PatientDetailedProfile extends Patient {
  financialSummary: {
    totalTreatmentExpenses: number;
    totalTestExpenses: number;
    totalAdditionalCharges: number;
    totalDiscounts: number;
    totalExpenses: number;
    totalAmountPaid: number;
    totalOutstandingDue: number;
  };
  stats: {
    totalVisits: number;
    totalDoctorsVisited: number;
    lastVisitDate: string | null;
    nextFollowUpDate: string | null;
  };
  doctorHistory: {
    id: number;
    name: string;
    specialization: string;
    visitCount: number;
  }[];
  visits: Visit[];
  treatments: Treatment[];
  diagnosticTests: DiagnosticTest[];
  payments: Payment[];
  appointments: Appointment[];
}

export interface AuditLog {
  id: number;
  userId?: number | null;
  userRole: string;
  userName?: string | null;
  username?: string | null;
  action: string;
  affectedRecord: string;
  details?: string | null;
  createdAt: string;
}

export interface DashboardStats {
  role: UserRole;
  totalPatients?: number;
  totalDoctors?: number;
  totalVisits?: number;
  todayVisits?: number;
  upcomingFollowUps?: number;
  totalTreatmentCharges?: number;
  totalTestCharges?: number;
  totalCollection?: number;
  totalOutstandingDues?: number;
  recentVisits?: any[];
  developerStats?: any;
  uniquePatients?: number;
  treatmentStats?: { name: string; count: number; totalEarned: string }[];
}
