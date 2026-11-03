import { relations } from 'drizzle-orm';
import {
  boolean,
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
