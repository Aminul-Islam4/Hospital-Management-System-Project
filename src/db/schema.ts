import { relations } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

// Users table (Doctors, Main Doctor, Developer)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').unique(), // Firebase Auth UID or system ID
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash'),
  email: text('email'),
  fullName: text('full_name').notNull(),
  role: text('role').notNull().default('doctor'), // 'main_doctor' | 'developer' | 'doctor'
  isActive: boolean('is_active').notNull().default(true),
  phone: text('phone'),
  specialization: text('specialization'),
  qualifications: text('qualifications'),
  registrationNumber: text('registration_number'),
  joiningDate: text('joining_date'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Patients table (Centralized permanent patient records)
export const patients = pgTable('patients', {
  id: serial('id').primaryKey(),
  patientId: text('patient_id').notNull().unique(), // e.g., DP-1001
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  altPhone: text('alt_phone'),
  age: integer('age'),
  gender: text('gender').notNull(), // 'Male' | 'Female' | 'Other'
  address: text('address'),
  registrationDate: text('registration_date').notNull(), // YYYY-MM-DD
  medicalHistory: text('medical_history'),
  allergies: text('allergies'),
  existingDiseases: text('existing_diseases'),
  notes: text('notes'),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Visits table (Shared across all doctors)
export const visits = pgTable('visits', {
  id: serial('id').primaryKey(),
  visitId: text('visit_id').notNull().unique(), // e.g., VST-1001
  patientId: integer('patient_id')
    .notNull()
    .references(() => patients.id),
  doctorId: integer('doctor_id')
    .notNull()
    .references(() => users.id),
  visitDate: text('visit_date').notNull(), // YYYY-MM-DD
  visitTime: text('visit_time'), // HH:mm
  complaints: text('complaints'),
  diagnosis: text('diagnosis'),
  notes: text('notes'),
  nextFollowUpDate: text('next_follow_up_date'),
  totalTreatmentCost: numeric('total_treatment_cost', { precision: 12, scale: 2 }).notNull().default('0'),
  totalTestCost: numeric('total_test_cost', { precision: 12, scale: 2 }).notNull().default('0'),
  additionalCharges: numeric('additional_charges', { precision: 12, scale: 2 }).notNull().default('0'),
  discount: numeric('discount', { precision: 12, scale: 2 }).notNull().default('0'),
  totalCost: numeric('total_cost', { precision: 12, scale: 2 }).notNull().default('0'),
  amountPaid: numeric('amount_paid', { precision: 12, scale: 2 }).notNull().default('0'),
  outstandingDue: numeric('outstanding_due', { precision: 12, scale: 2 }).notNull().default('0'),
  status: text('status').notNull().default('Completed'), // 'Completed' | 'In Progress' | 'Cancelled'
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Treatments table (Multiple per visit)
export const treatments = pgTable('treatments', {
  id: serial('id').primaryKey(),
  visitId: integer('visit_id')
    .notNull()
    .references(() => visits.id),
  patientId: integer('patient_id')
    .notNull()
    .references(() => patients.id),
  doctorId: integer('doctor_id')
    .notNull()
    .references(() => users.id),
  treatmentName: text('treatment_name').notNull(),
  description: text('description'),
  toothNumber: text('tooth_number'),
  cost: numeric('cost', { precision: 12, scale: 2 }).notNull().default('0'),
  status: text('status').notNull().default('Completed'), // 'Completed' | 'Ongoing' | 'Planned'
  notes: text('notes'),
  treatmentDate: text('treatment_date').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Diagnostic Tests and X-rays table (Mandatory module)
export const diagnosticTests = pgTable('diagnostic_tests', {
  id: serial('id').primaryKey(),
  visitId: integer('visit_id')
    .notNull()
    .references(() => visits.id),
  patientId: integer('patient_id')
    .notNull()
    .references(() => patients.id),
  doctorId: integer('doctor_id')
    .notNull()
    .references(() => users.id),
  testName: text('test_name').notNull(),
  category: text('category').notNull(), // 'Dental X-ray' | 'OPG' | 'IOPA' | 'CBCT' | 'Other'
  description: text('description'),
  cost: numeric('cost', { precision: 12, scale: 2 }).notNull().default('0'),
  status: text('status').notNull().default('Completed'), // 'Completed' | 'Requested' | 'Pending'
  notes: text('notes'),
  testDate: text('test_date').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Payments table (Partial payments supported per visit)
export const payments = pgTable('payments', {
  id: serial('id').primaryKey(),
  paymentId: text('payment_id').notNull().unique(), // e.g., PAY-1001
  patientId: integer('patient_id')
    .notNull()
    .references(() => patients.id),
  visitId: integer('visit_id')
    .notNull()
    .references(() => visits.id),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  paymentMethod: text('payment_method').notNull(), // 'Cash' | 'bKash' | 'Nagad' | 'Bank transfer' | 'Other'
  transactionRef: text('transaction_ref'),
  notes: text('notes'),
  receivedBy: integer('received_by').references(() => users.id),
  paymentDate: text('payment_date').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Appointments / Follow-ups table
export const appointments = pgTable('appointments', {
  id: serial('id').primaryKey(),
  patientId: integer('patient_id')
    .notNull()
    .references(() => patients.id),
  visitId: integer('visit_id').references(() => visits.id),
  doctorId: integer('doctor_id')
    .notNull()
    .references(() => users.id),
  followUpDate: text('follow_up_date').notNull(), // YYYY-MM-DD
  reason: text('reason').notNull(),
  status: text('status').notNull().default('Scheduled'), // 'Scheduled' | 'Completed' | 'Cancelled' | 'Missed'
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Audit logs table
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  userRole: text('user_role').notNull(),
  action: text('action').notNull(), // e.g. 'CREATE_PATIENT', 'UPDATE_VISIT', 'RECORD_PAYMENT'
  affectedRecord: text('affected_record').notNull(), // e.g. 'Patient DP-1001'
  details: text('details'),
  createdAt: timestamp('created_at').defaultNow(),
});

// System settings table
export const systemSettings = pgTable('system_settings', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  description: text('description'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Global Application Feature Flags table (Controlled exclusively by Developer role)
export const applicationFeatureFlags = pgTable('application_feature_flags', {
  id: serial('id').primaryKey(),
  featureKey: text('feature_key').notNull().unique(),
  featureName: text('feature_name').notNull(),
  description: text('description'),
  isEnabled: boolean('is_enabled').notNull().default(true),
  updatedBy: integer('updated_by').references(() => users.id),
  updatedAt: timestamp('updated_at').defaultNow(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Dental Prescriptions table
export const prescriptions = pgTable(
  'prescriptions',
  {
    id: serial('id').primaryKey(),
    prescriptionNumber: text('prescription_number').notNull().unique(), // e.g., RX-1001
    patientId: integer('patient_id')
      .notNull()
      .references(() => patients.id),
    doctorId: integer('doctor_id')
      .notNull()
      .references(() => users.id),
    visitId: integer('visit_id')
      .notNull()
      .references(() => visits.id),
    parentPrescriptionId: integer('parent_prescription_id'),
    rootPrescriptionId: integer('root_prescription_id'),
    templateSourceId: integer('template_source_id'),
    revisionNumber: integer('revision_number').notNull().default(1),
    status: text('status').notNull().default('Draft'), // 'Draft' | 'Finalized' | 'Revised'
    prescriptionDate: text('prescription_date').notNull(), // YYYY-MM-DD
    chiefComplaints: text('chief_complaints'),
    clinicalFindings: text('clinical_findings'),
    diagnosis: text('diagnosis'),
    treatmentPlan: text('treatment_plan'),
    showPlanCosts: boolean('show_plan_costs').notNull().default(true),
    followUpDate: text('follow_up_date'),
    oralHygieneInstructions: text('oral_hygiene_instructions'),
    toothBrushingInstructions: text('tooth_brushing_instructions'),
    mouthwashRecommendations: text('mouthwash_recommendations'),
    postExtractionInstructions: text('post_extraction_instructions'),
    postTreatmentPrecautions: text('post_treatment_precautions'),
    dietaryRecommendations: text('dietary_recommendations'),
    additionalClinicalAdvice: text('additional_clinical_advice'),
    idempotencyKey: text('idempotency_key').unique(),
    finalizedAt: timestamp('finalized_at'),
    finalizedBy: integer('finalized_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('idx_prescriptions_patient_id').on(table.patientId),
    index('idx_prescriptions_doctor_id').on(table.doctorId),
    index('idx_prescriptions_visit_id').on(table.visitId),
    index('idx_prescriptions_date').on(table.prescriptionDate),
    index('idx_prescriptions_status').on(table.status),
  ]
);

// Bangladesh Medicine Master Catalog table (separate from historical prescriptions)
export const medicines = pgTable(
  'medicines',
  {
    id: serial('id').primaryKey(),
    medicineCode: text('medicine_code').notNull().unique(), // e.g., MED-00001
    genericName: text('generic_name').notNull(),
    brandName: text('brand_name').notNull(),
    packageMark: text('package_mark'),
    dosageType: text('dosage_type').notNull(),
    strength: text('strength'),
    manufacturer: text('manufacturer').notNull(),
    normGeneric: text('norm_generic').notNull(),
    normBrand: text('norm_brand').notNull(),
    normPackageMark: text('norm_package_mark').notNull().default(''),
    normDosageType: text('norm_dosage_type').notNull(),
    normStrength: text('norm_strength').notNull().default(''),
    normManufacturer: text('norm_manufacturer').notNull(),
    identityKey: text('identity_key').notNull().unique(), // SHA-256 of normalized 6-field identity
    clinicalKey: text('clinical_key').notNull(), // SHA-256 of normalized 5 clinical fields (brand+generic+dosageType+strength+manufacturer)
    source: text('source').notNull().default('Medicinal Products in Bangladesh CSV'),
    isActive: boolean('is_active').notNull().default(true),
    lastImportBatchId: integer('last_import_batch_id'),
    createdBy: integer('created_by').references(() => users.id),
    updatedBy: integer('updated_by').references(() => users.id),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('idx_medicines_norm_brand').on(table.normBrand),
    index('idx_medicines_norm_generic').on(table.normGeneric),
    index('idx_medicines_norm_strength').on(table.normStrength),
    index('idx_medicines_norm_dosage').on(table.normDosageType),
    index('idx_medicines_norm_mfg').on(table.normManufacturer),
    index('idx_medicines_clinical_key').on(table.clinicalKey),
    index('idx_medicines_active').on(table.isActive),
  ]
);

// Medicine Catalog Backup Snapshots (for controlled catalog-only rollback)
export const medicineCatalogSnapshots = pgTable('medicine_catalog_snapshots', {
  id: serial('id').primaryKey(),
  snapshotCode: text('snapshot_code').notNull().unique(),
  label: text('label').notNull(),
  recordCount: integer('record_count').notNull().default(0),
  snapshotData: text('snapshot_data').notNull(), // gzip:base64 or JSON snapshot of medicines table
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
});

// Medicine CSV Import History & Reconciliation Batches
export const medicineImportBatches = pgTable('medicine_import_batches', {
  id: serial('id').primaryKey(),
  batchCode: text('batch_code').notNull().unique(),
  filename: text('filename').notNull(),
  sourceLabel: text('source_label').notNull(),
  importMode: text('import_mode').notNull(), // 'add_only' | 'add_and_update' | 'full_reconcile'
  status: text('status').notNull().default('completed'), // 'completed' | 'rolled_back' | 'failed'
  uploadedBy: integer('uploaded_by').references(() => users.id),
  totalRecords: integer('total_records').notNull().default(0),
  addedCount: integer('added_count').notNull().default(0),
  updatedCount: integer('updated_count').notNull().default(0),
  unchangedCount: integer('unchanged_count').notNull().default(0),
  skippedCount: integer('skipped_count').notNull().default(0),
  rejectedCount: integer('rejected_count').notNull().default(0),
  missingCount: integer('missing_count').notNull().default(0),
  deactivatedCount: integer('deactivated_count').notNull().default(0),
  snapshotId: integer('snapshot_id').references(() => medicineCatalogSnapshots.id, {
    onDelete: 'set null',
  }),
  summaryJson: text('summary_json'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Medicine Database Audit Logs
export const medicineAuditLogs = pgTable(
  'medicine_audit_logs',
  {
    id: serial('id').primaryKey(),
    medicineId: integer('medicine_id').references(() => medicines.id, { onDelete: 'set null' }),
    importBatchId: integer('import_batch_id').references(() => medicineImportBatches.id, {
      onDelete: 'set null',
    }),
    userId: integer('user_id').references(() => users.id),
    userRole: text('user_role').notNull(),
    action: text('action').notNull(),
    targetName: text('target_name').notNull(),
    previousValuesJson: text('previous_values_json'),
    newValuesJson: text('new_values_json'),
    details: text('details'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    index('idx_medicine_audit_med_id').on(table.medicineId),
    index('idx_medicine_audit_batch_id').on(table.importBatchId),
  ]
);

// Dynamic Prescription Medicines table (stores historical clinical snapshot independent of catalog edits)
export const prescriptionMedicines = pgTable(
  'prescription_medicines',
  {
    id: serial('id').primaryKey(),
    prescriptionId: integer('prescription_id')
      .notNull()
      .references(() => prescriptions.id, { onDelete: 'cascade' }),
    medicineId: integer('medicine_id').references(() => medicines.id, { onDelete: 'set null' }),
    sortOrder: integer('sort_order').notNull().default(0),
    medicineName: text('medicine_name').notNull(),
    genericName: text('generic_name'),
    dosageType: text('dosage_type'),
    strength: text('strength'),
    manufacturer: text('manufacturer'),
    packageMark: text('package_mark'),
    dosage: text('dosage'),
    frequency: text('frequency'),
    duration: text('duration'),
    quantity: text('quantity'),
    mealInstructions: text('meal_instructions'),
    additionalNotes: text('additional_notes'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [
    index('idx_prescription_medicines_rx_id').on(table.prescriptionId),
    index('idx_prescription_medicines_med_id').on(table.medicineId),
    index('idx_prescription_medicines_name').on(table.medicineName),
  ]
);

// Optional Treatment Plan Items on Prescription (with optional estimated cost)
export const prescriptionTreatmentPlans = pgTable(
  'prescription_treatment_plans',
  {
    id: serial('id').primaryKey(),
    prescriptionId: integer('prescription_id')
      .notNull()
      .references(() => prescriptions.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull().default(0),
    treatmentName: text('treatment_name').notNull(),
    toothNumber: text('tooth_number'),
    cost: numeric('cost', { precision: 12, scale: 2 }),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [index('idx_rx_treatment_plans_rx_id').on(table.prescriptionId)]
);

// Optional Advised Diagnostic Tests on Prescription (with optional estimated cost)
export const prescriptionAdvisedTests = pgTable(
  'prescription_advised_tests',
  {
    id: serial('id').primaryKey(),
    prescriptionId: integer('prescription_id')
      .notNull()
      .references(() => prescriptions.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull().default(0),
    testName: text('test_name').notNull(),
    category: text('category'),
    cost: numeric('cost', { precision: 12, scale: 2 }),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [index('idx_rx_advised_tests_rx_id').on(table.prescriptionId)]
);

// Personalized Clinical Headings saved per Doctor (reusable default headings)
export const doctorClinicalHeadings = pgTable(
  'doctor_clinical_headings',
  {
    id: serial('id').primaryKey(),
    doctorId: integer('doctor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull().default(0),
    heading: text('heading').notNull(),
    defaultPlaceholder: text('default_placeholder'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [index('idx_doctor_clinical_headings_doc_id').on(table.doctorId)]
);

// Personalized Clinical Heading Entries stored per Prescription (immutable snapshot on finalize)
export const prescriptionCustomSections = pgTable(
  'prescription_custom_sections',
  {
    id: serial('id').primaryKey(),
    prescriptionId: integer('prescription_id')
      .notNull()
      .references(() => prescriptions.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull().default(0),
    heading: text('heading').notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [index('idx_rx_custom_sections_rx_id').on(table.prescriptionId)]
);

// Prescription Revisions history table (immutable audit snapshots on revision)
export const prescriptionRevisions = pgTable('prescription_revisions', {
  id: serial('id').primaryKey(),
  prescriptionId: integer('prescription_id')
    .notNull()
    .references(() => prescriptions.id, { onDelete: 'cascade' }),
  previousPrescriptionId: integer('previous_prescription_id')
    .notNull()
    .references(() => prescriptions.id),
  revisionNumber: integer('revision_number').notNull(),
  revisionReason: text('revision_reason'),
  snapshotJson: text('snapshot_json').notNull(),
  createdBy: integer('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
});

// Prescription Audit Logs table
export const prescriptionAuditLogs = pgTable('prescription_audit_logs', {
  id: serial('id').primaryKey(),
  prescriptionId: integer('prescription_id').references(() => prescriptions.id, { onDelete: 'set null' }),
  prescriptionNumber: text('prescription_number').notNull(),
  userId: integer('user_id').references(() => users.id),
  userRole: text('user_role').notNull(),
  action: text('action').notNull(),
  details: text('details'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Relationships
export const usersRelations = relations(users, ({ many }) => ({
  visits: many(visits),
  treatments: many(treatments),
  diagnosticTests: many(diagnosticTests),
  patientsCreated: many(patients),
  appointments: many(appointments),
}));

export const patientsRelations = relations(patients, ({ one, many }) => ({
  creator: one(users, {
    fields: [patients.createdBy],
    references: [users.id],
  }),
  visits: many(visits),
  treatments: many(treatments),
  diagnosticTests: many(diagnosticTests),
  payments: many(payments),
  appointments: many(appointments),
}));

export const visitsRelations = relations(visits, ({ one, many }) => ({
  patient: one(patients, {
    fields: [visits.patientId],
    references: [patients.id],
  }),
  doctor: one(users, {
    fields: [visits.doctorId],
    references: [users.id],
  }),
  treatments: many(treatments),
  diagnosticTests: many(diagnosticTests),
  payments: many(payments),
  appointments: many(appointments),
}));

export const treatmentsRelations = relations(treatments, ({ one }) => ({
  visit: one(visits, {
    fields: [treatments.visitId],
    references: [visits.id],
  }),
  patient: one(patients, {
    fields: [treatments.patientId],
    references: [patients.id],
  }),
  doctor: one(users, {
    fields: [treatments.doctorId],
    references: [users.id],
  }),
}));

export const diagnosticTestsRelations = relations(diagnosticTests, ({ one }) => ({
  visit: one(visits, {
    fields: [diagnosticTests.visitId],
    references: [visits.id],
  }),
  patient: one(patients, {
    fields: [diagnosticTests.patientId],
    references: [patients.id],
  }),
  doctor: one(users, {
    fields: [diagnosticTests.doctorId],
    references: [users.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  visit: one(visits, {
    fields: [payments.visitId],
    references: [visits.id],
  }),
  patient: one(patients, {
    fields: [payments.patientId],
    references: [patients.id],
  }),
  receiver: one(users, {
    fields: [payments.receivedBy],
    references: [users.id],
  }),
}));

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  patient: one(patients, {
    fields: [appointments.patientId],
    references: [patients.id],
  }),
  visit: one(visits, {
    fields: [appointments.visitId],
    references: [visits.id],
  }),
  doctor: one(users, {
    fields: [appointments.doctorId],
    references: [users.id],
  }),
}));

export const prescriptionsRelations = relations(prescriptions, ({ one, many }) => ({
  patient: one(patients, {
    fields: [prescriptions.patientId],
    references: [patients.id],
  }),
  doctor: one(users, {
    fields: [prescriptions.doctorId],
    references: [users.id],
  }),
  visit: one(visits, {
    fields: [prescriptions.visitId],
    references: [visits.id],
  }),
  medicines: many(prescriptionMedicines),
  treatmentPlanItems: many(prescriptionTreatmentPlans),
  advisedTests: many(prescriptionAdvisedTests),
  customSections: many(prescriptionCustomSections),
  revisions: many(prescriptionRevisions),
  auditLogs: many(prescriptionAuditLogs),
}));

export const prescriptionMedicinesRelations = relations(prescriptionMedicines, ({ one }) => ({
  prescription: one(prescriptions, {
    fields: [prescriptionMedicines.prescriptionId],
    references: [prescriptions.id],
  }),
  catalogMedicine: one(medicines, {
    fields: [prescriptionMedicines.medicineId],
    references: [medicines.id],
  }),
}));

export const prescriptionTreatmentPlansRelations = relations(
  prescriptionTreatmentPlans,
  ({ one }) => ({
    prescription: one(prescriptions, {
      fields: [prescriptionTreatmentPlans.prescriptionId],
      references: [prescriptions.id],
    }),
  })
);

export const prescriptionAdvisedTestsRelations = relations(
  prescriptionAdvisedTests,
  ({ one }) => ({
    prescription: one(prescriptions, {
      fields: [prescriptionAdvisedTests.prescriptionId],
      references: [prescriptions.id],
    }),
  })
);

export const prescriptionRevisionsRelations = relations(prescriptionRevisions, ({ one }) => ({
  prescription: one(prescriptions, {
    fields: [prescriptionRevisions.prescriptionId],
    references: [prescriptions.id],
  }),
  creator: one(users, {
    fields: [prescriptionRevisions.createdBy],
    references: [users.id],
  }),
}));

export const prescriptionAuditLogsRelations = relations(prescriptionAuditLogs, ({ one }) => ({
  prescription: one(prescriptions, {
    fields: [prescriptionAuditLogs.prescriptionId],
    references: [prescriptions.id],
  }),
  user: one(users, {
    fields: [prescriptionAuditLogs.userId],
    references: [users.id],
  }),
}));

export const doctorClinicalHeadingsRelations = relations(doctorClinicalHeadings, ({ one }) => ({
  doctor: one(users, {
    fields: [doctorClinicalHeadings.doctorId],
    references: [users.id],
  }),
}));

export const prescriptionCustomSectionsRelations = relations(
  prescriptionCustomSections,
  ({ one }) => ({
    prescription: one(prescriptions, {
      fields: [prescriptionCustomSections.prescriptionId],
      references: [prescriptions.id],
    }),
  })
);
