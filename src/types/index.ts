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
  registrationNumber?: string | null;
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
  totalTreatmentExpenses?: number;
  totalTestExpenses?: number;
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
  smsSent?: boolean;
  smsReminderSent?: boolean;
  smsSentCount?: number;
  lastSmsSentAt?: string | null;
  lastSmsMessage?: string | null;
  smsSentAt?: string | null;
  smsSentBy?: string | null;
  smsMessage?: string | null;
}

export interface SmsReminderLog {
  id: string;
  appointmentId: number;
  patientId: number;
  patientCode: string;
  patientName: string;
  patientPhone: string;
  doctorName: string;
  followUpDate: string;
  reason: string;
  message: string;
  sentAt: string;
  sentBy: string;
  channel: string;
  status?: 'Sent' | 'Delivered';
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

export interface ApplicationFeatureFlag {
  id: number;
  featureKey: string;
  featureName: string;
  description?: string | null;
  isEnabled: boolean;
  updatedAt?: string | null;
}

export type PrescriptionStatus = 'Draft' | 'Finalized' | 'Revised';

export interface PrescriptionMedicine {
  id?: number;
  prescriptionId?: number;
  medicineId?: number | null;
  sortOrder?: number;
  medicineName: string;
  genericName?: string | null;
  strength?: string | null;
  dosageType?: string | null;
  manufacturer?: string | null;
  packageMark?: string | null;
  dosage?: string | null;
  frequency?: string | null;
  duration?: string | null;
  quantity?: string | null;
  mealInstructions?: string | null;
  additionalNotes?: string | null;
}

export interface PrescriptionMedicineSuggestion {
  medicineName: string;
  genericName: string;
  strength: string;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: string;
  mealInstructions: string;
}

export interface CatalogMedicine {
  id: number;
  medicineCode: string;
  genericName: string;
  brandName: string;
  packageMark?: string | null;
  dosageType: string;
  strength?: string | null;
  manufacturer: string;
  source: string;
  isActive: boolean;
  lastImportBatchId?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface MedicineSearchResponse {
  items: CatalogMedicine[];
  totalCount: number;
  hasMore: boolean;
}

export type MedicineImportMode = 'add_only' | 'add_and_update' | 'full_reconcile';

export interface MedicineColumnMapping {
  genericName: string;
  brandName: string;
  packageMark: string;
  dosageType: string;
  strength: string;
  manufacturer: string;
}

export interface MedicineImportBatch {
  id: number;
  batchCode: string;
  filename: string;
  sourceLabel: string;
  importMode: MedicineImportMode;
  status: string;
  totalRecords: number;
  addedCount: number;
  updatedCount: number;
  unchangedCount: number;
  skippedCount: number;
  rejectedCount: number;
  missingCount: number;
  deactivatedCount: number;
  snapshotId?: number | null;
  summaryJson?: string | null;
  uploadedByName?: string | null;
  createdAt: string;
}

export interface MedicineOverviewStats {
  totalMedicines: number;
  activeMedicines: number;
  inactiveMedicines: number;
  totalGenerics: number;
  totalManufacturers: number;
  recentlyAddedCount: number;
  recentlyUpdatedCount: number;
  lastUpdatedAt?: string | null;
  lastImport: MedicineImportBatch | null;
}

export interface MedicineImportPreviewResponse {
  headers: string[];
  mapping: MedicineColumnMapping;
  importMode: MedicineImportMode;
  counts: {
    totalRecords: number;
    newRecords: number;
    updatedRecords: number;
    unchangedRecords: number;
    possibleDuplicates: number;
    invalidRecords: number;
    missingRecords: number;
  };
  samples: {
    newRecords: {
      rowNumber: number;
      brandName: string;
      genericName: string;
      dosageType: string;
      strength: string;
      manufacturer: string;
      packageMark: string;
    }[];
    updatedRecords: {
      existingId: number;
      medicineCode: string;
      previous: Partial<CatalogMedicine>;
      merged: Partial<CatalogMedicine>;
    }[];
    unchangedRecords: {
      existingId: number;
      medicineCode: string;
      brandName: string;
      strength: string;
    }[];
    possibleDuplicates: {
      rowNumber: number;
      brandName: string;
      genericName: string;
      strength: string;
      reason: string;
    }[];
    invalidRecords: {
      rowNumber: number;
      raw: Record<string, string>;
      reason: string;
    }[];
    missingRecords: {
      id: number;
      medicineCode: string;
      brandName: string;
      genericName: string;
      dosageType: string;
      strength: string;
      manufacturer: string;
    }[];
  };
  allMissingIds: number[];
}

export interface MedicineCatalogSnapshot {
  id: number;
  snapshotCode: string;
  label: string;
  recordCount: number;
  createdAt: string;
  createdByName?: string | null;
}

export interface MedicineAuditLog {
  id: number;
  medicineId?: number | null;
  importBatchId?: number | null;
  userRole: string;
  userName?: string | null;
  action: string;
  targetName: string;
  previousValuesJson?: string | null;
  newValuesJson?: string | null;
  details?: string | null;
  createdAt: string;
}

export interface MedicineDetailResponse {
  medicine: CatalogMedicine;
  prescriptionUsageCount: number;
  auditLogs: MedicineAuditLog[];
}

export interface PrescriptionRevision {
  id: number;
  prescriptionId: number;
  previousPrescriptionId: number;
  revisionNumber: number;
  revisionReason?: string | null;
  createdBy: number;
  createdByName?: string | null;
  createdAt: string;
}

export interface PrescriptionAuditLog {
  id: number;
  action: string;
  userRole: string;
  userName?: string | null;
  details?: string | null;
  createdAt: string;
}

export interface PrescriptionTreatmentPlanItem {
  id?: number;
  prescriptionId?: number;
  sortOrder?: number;
  treatmentName: string;
  toothNumber?: string | null;
  cost?: string | null;
  notes?: string | null;
}

export interface PrescriptionAdvisedTestItem {
  id?: number;
  prescriptionId?: number;
  sortOrder?: number;
  testName: string;
  category?: string | null;
  cost?: string | null;
  notes?: string | null;
}

export interface DoctorClinicalHeading {
  id?: number;
  doctorId?: number;
  sortOrder?: number;
  heading: string;
  defaultPlaceholder?: string | null;
}

export interface PrescriptionCustomSection {
  id?: number;
  prescriptionId?: number;
  sortOrder?: number;
  heading: string;
  content: string;
}

export interface Prescription {
  id: number;
  prescriptionNumber: string;
  patientId: number;
  doctorId: number;
  visitId: number;
  parentPrescriptionId?: number | null;
  rootPrescriptionId?: number | null;
  templateSourceId?: number | null;
  revisionNumber: number;
  status: PrescriptionStatus;
  prescriptionDate: string;
  chiefComplaints?: string | null;
  clinicalFindings?: string | null;
  diagnosis?: string | null;
  treatmentPlan?: string | null;
  showPlanCosts?: boolean;
  followUpDate?: string | null;
  oralHygieneInstructions?: string | null;
  toothBrushingInstructions?: string | null;
  mouthwashRecommendations?: string | null;
  postExtractionInstructions?: string | null;
  postTreatmentPrecautions?: string | null;
  dietaryRecommendations?: string | null;
  additionalClinicalAdvice?: string | null;
  finalizedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;

  // Hydrated fields
  patientCode?: string;
  patientName?: string;
  patientAge?: number | null;
  patientGender?: string;
  patientPhone?: string;
  patientAddress?: string | null;
  patientAllergies?: string | null;
  patientExistingDiseases?: string | null;
  doctorName?: string;
  doctorDesignation?: string;
  doctorQualification?: string | null;
  doctorRegistrationNumber?: string | null;
  doctorPhone?: string | null;
  doctorEmail?: string | null;
  visitCode?: string;
  visitDate?: string;
  medicines: PrescriptionMedicine[];
  treatmentPlanItems?: PrescriptionTreatmentPlanItem[];
  advisedTests?: PrescriptionAdvisedTestItem[];
  customSections?: PrescriptionCustomSection[];
  clinic?: {
    clinicName: string;
    clinicAddress: string;
    clinicPhone: string;
  };
  revisions?: PrescriptionRevision[];
  revisionLineage?: {
    id: number;
    prescriptionNumber: string;
    revisionNumber: number;
    status: PrescriptionStatus;
    prescriptionDate: string;
    createdAt: string;
  }[];
  auditLogs?: PrescriptionAuditLog[];
}
