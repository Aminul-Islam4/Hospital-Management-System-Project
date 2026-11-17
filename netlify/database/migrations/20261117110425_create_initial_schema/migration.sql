CREATE TABLE "application_feature_flags" (
	"id" serial PRIMARY KEY,
	"feature_key" text NOT NULL UNIQUE,
	"feature_name" text NOT NULL,
	"description" text,
	"module_category" text DEFAULT 'Clinical' NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"applicable_roles_json" text DEFAULT '["developer","main_doctor","doctor"]' NOT NULL,
	"config_json" text,
	"updated_by" integer,
	"updated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" serial PRIMARY KEY,
	"patient_id" integer NOT NULL,
	"visit_id" integer,
	"doctor_id" integer NOT NULL,
	"follow_up_date" text NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'Scheduled' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY,
	"user_id" integer,
	"user_role" text NOT NULL,
	"action" text NOT NULL,
	"affected_record" text NOT NULL,
	"details" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "backup_history_logs" (
	"id" serial PRIMARY KEY,
	"backup_code" text NOT NULL UNIQUE,
	"backup_type" text NOT NULL,
	"export_format" text NOT NULL,
	"requested_by" integer,
	"requested_by_name" text NOT NULL,
	"user_role" text NOT NULL,
	"doctor_scope_id" integer,
	"date_preset" text DEFAULT 'all' NOT NULL,
	"from_date" text,
	"to_date" text,
	"selected_modules_json" text DEFAULT '[]' NOT NULL,
	"record_counts_json" text DEFAULT '{}' NOT NULL,
	"total_records" integer DEFAULT 0 NOT NULL,
	"file_size_bytes" integer DEFAULT 0 NOT NULL,
	"filename" text NOT NULL,
	"status" text DEFAULT 'Success' NOT NULL,
	"failure_reason" text,
	"manifest_json" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "clinic_subscriptions" (
	"id" serial PRIMARY KEY,
	"clinic_code" text NOT NULL UNIQUE,
	"clinic_name" text DEFAULT 'Dental Care' NOT NULL,
	"branch_code" text DEFAULT 'MAIN_BRANCH' NOT NULL,
	"package_id" integer,
	"package_key" text DEFAULT 'enterprise' NOT NULL,
	"package_name" text DEFAULT 'Enterprise' NOT NULL,
	"status" text DEFAULT 'Active' NOT NULL,
	"start_date" text NOT NULL,
	"expiry_date" text,
	"trial_ends_at" text,
	"notes" text,
	"assigned_by" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "diagnostic_tests" (
	"id" serial PRIMARY KEY,
	"visit_id" integer NOT NULL,
	"patient_id" integer NOT NULL,
	"doctor_id" integer NOT NULL,
	"source_prescription_id" integer,
	"test_name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"cost" numeric(12,2) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'Completed' NOT NULL,
	"notes" text,
	"test_date" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "doctor_clinical_headings" (
	"id" serial PRIMARY KEY,
	"doctor_id" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"heading" text NOT NULL,
	"default_placeholder" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "doctor_salaries" (
	"id" serial PRIMARY KEY,
	"salary_code" text NOT NULL UNIQUE,
	"doctor_id" integer NOT NULL,
	"salary_type" text DEFAULT 'Monthly' NOT NULL,
	"period_label" text NOT NULL,
	"payroll_month" text,
	"payroll_year" integer,
	"period_start" text,
	"period_end" text,
	"base_amount" numeric(12,2) DEFAULT '0' NOT NULL,
	"days_worked" integer DEFAULT 0 NOT NULL,
	"commission_basis" text DEFAULT 'collected',
	"commission_source_amount" numeric(12,2) DEFAULT '0' NOT NULL,
	"commission_rate" numeric(6,2) DEFAULT '0' NOT NULL,
	"commission_earned" numeric(12,2) DEFAULT '0' NOT NULL,
	"gross_salary" numeric(12,2) DEFAULT '0' NOT NULL,
	"bonus_amount" numeric(12,2) DEFAULT '0' NOT NULL,
	"deduction_amount" numeric(12,2) DEFAULT '0' NOT NULL,
	"total_payable" numeric(12,2) DEFAULT '0' NOT NULL,
	"paid_amount" numeric(12,2) DEFAULT '0' NOT NULL,
	"due_amount" numeric(12,2) DEFAULT '0' NOT NULL,
	"payroll_status" text DEFAULT 'Draft' NOT NULL,
	"payment_status" text DEFAULT 'Paid' NOT NULL,
	"payment_method" text DEFAULT 'Cash' NOT NULL,
	"transaction_ref" text,
	"payment_date" text NOT NULL,
	"notes" text,
	"structure_snapshot_json" text,
	"finalized_at" timestamp,
	"finalized_by" integer,
	"recorded_by" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "doctor_salary_structure_history" (
	"id" serial PRIMARY KEY,
	"structure_id" integer,
	"doctor_id" integer NOT NULL,
	"salary_type" text NOT NULL,
	"base_rate" numeric(12,2) DEFAULT '0' NOT NULL,
	"commission_rate" numeric(6,2) DEFAULT '0' NOT NULL,
	"commission_basis" text DEFAULT 'treatment_revenue' NOT NULL,
	"allowances" numeric(12,2) DEFAULT '0' NOT NULL,
	"deductions" numeric(12,2) DEFAULT '0' NOT NULL,
	"effective_date" text NOT NULL,
	"review_date" text,
	"change_reason" text,
	"changed_by" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "doctor_salary_structures" (
	"id" serial PRIMARY KEY,
	"structure_code" text NOT NULL UNIQUE,
	"doctor_id" integer NOT NULL UNIQUE,
	"salary_type" text DEFAULT 'Monthly' NOT NULL,
	"base_rate" numeric(12,2) DEFAULT '0' NOT NULL,
	"commission_rate" numeric(6,2) DEFAULT '0' NOT NULL,
	"commission_basis" text DEFAULT 'treatment_revenue' NOT NULL,
	"allowances" numeric(12,2) DEFAULT '0' NOT NULL,
	"deductions" numeric(12,2) DEFAULT '0' NOT NULL,
	"effective_date" text NOT NULL,
	"review_date" text,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" integer,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "medicine_audit_logs" (
	"id" serial PRIMARY KEY,
	"medicine_id" integer,
	"import_batch_id" integer,
	"user_id" integer,
	"user_role" text NOT NULL,
	"action" text NOT NULL,
	"target_name" text NOT NULL,
	"previous_values_json" text,
	"new_values_json" text,
	"details" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "medicine_catalog_snapshots" (
	"id" serial PRIMARY KEY,
	"snapshot_code" text NOT NULL UNIQUE,
	"label" text NOT NULL,
	"record_count" integer DEFAULT 0 NOT NULL,
	"snapshot_data" text NOT NULL,
	"created_by" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "medicine_import_batches" (
	"id" serial PRIMARY KEY,
	"batch_code" text NOT NULL UNIQUE,
	"filename" text NOT NULL,
	"source_label" text NOT NULL,
	"import_mode" text NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"uploaded_by" integer,
	"total_records" integer DEFAULT 0 NOT NULL,
	"added_count" integer DEFAULT 0 NOT NULL,
	"updated_count" integer DEFAULT 0 NOT NULL,
	"unchanged_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"rejected_count" integer DEFAULT 0 NOT NULL,
	"missing_count" integer DEFAULT 0 NOT NULL,
	"deactivated_count" integer DEFAULT 0 NOT NULL,
	"snapshot_id" integer,
	"summary_json" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "medicines" (
	"id" serial PRIMARY KEY,
	"medicine_code" text NOT NULL UNIQUE,
	"generic_name" text NOT NULL,
	"brand_name" text NOT NULL,
	"package_mark" text,
	"dosage_type" text NOT NULL,
	"strength" text,
	"manufacturer" text NOT NULL,
	"norm_generic" text NOT NULL,
	"norm_brand" text NOT NULL,
	"norm_package_mark" text DEFAULT '' NOT NULL,
	"norm_dosage_type" text NOT NULL,
	"norm_strength" text DEFAULT '' NOT NULL,
	"norm_manufacturer" text NOT NULL,
	"identity_key" text NOT NULL UNIQUE,
	"clinical_key" text NOT NULL,
	"source" text DEFAULT 'Medicinal Products in Bangladesh CSV' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_import_batch_id" integer,
	"created_by" integer,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" serial PRIMARY KEY,
	"patient_id" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"alt_phone" text,
	"age" integer,
	"gender" text NOT NULL,
	"address" text,
	"registration_date" text NOT NULL,
	"medical_history" text,
	"allergies" text,
	"existing_diseases" text,
	"notes" text,
	"created_by" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" serial PRIMARY KEY,
	"payment_id" text NOT NULL UNIQUE,
	"patient_id" integer NOT NULL,
	"visit_id" integer NOT NULL,
	"amount" numeric(12,2) NOT NULL,
	"payment_method" text NOT NULL,
	"transaction_ref" text,
	"notes" text,
	"received_by" integer,
	"payment_date" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payroll_audit_logs" (
	"id" serial PRIMARY KEY,
	"salary_id" integer,
	"doctor_id" integer,
	"user_id" integer,
	"user_role" text NOT NULL,
	"action" text NOT NULL,
	"target_label" text NOT NULL,
	"details" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "prescription_advised_tests" (
	"id" serial PRIMARY KEY,
	"prescription_id" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"test_name" text NOT NULL,
	"category" text,
	"cost" numeric(12,2),
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "prescription_audit_logs" (
	"id" serial PRIMARY KEY,
	"prescription_id" integer,
	"prescription_number" text NOT NULL,
	"user_id" integer,
	"user_role" text NOT NULL,
	"action" text NOT NULL,
	"details" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "prescription_custom_sections" (
	"id" serial PRIMARY KEY,
	"prescription_id" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"heading" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "prescription_medicines" (
	"id" serial PRIMARY KEY,
	"prescription_id" integer NOT NULL,
	"medicine_id" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"medicine_name" text NOT NULL,
	"generic_name" text,
	"dosage_type" text,
	"strength" text,
	"manufacturer" text,
	"package_mark" text,
	"dosage" text,
	"frequency" text,
	"duration" text,
	"quantity" text,
	"meal_instructions" text,
	"additional_notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "prescription_revisions" (
	"id" serial PRIMARY KEY,
	"prescription_id" integer NOT NULL,
	"previous_prescription_id" integer NOT NULL,
	"revision_number" integer NOT NULL,
	"revision_reason" text,
	"snapshot_json" text NOT NULL,
	"created_by" integer NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "prescription_treatment_plans" (
	"id" serial PRIMARY KEY,
	"prescription_id" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"treatment_name" text NOT NULL,
	"tooth_number" text,
	"cost" numeric(12,2),
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "prescriptions" (
	"id" serial PRIMARY KEY,
	"prescription_number" text NOT NULL UNIQUE,
	"patient_id" integer NOT NULL,
	"doctor_id" integer NOT NULL,
	"visit_id" integer NOT NULL,
	"parent_prescription_id" integer,
	"root_prescription_id" integer,
	"template_source_id" integer,
	"revision_number" integer DEFAULT 1 NOT NULL,
	"status" text DEFAULT 'Draft' NOT NULL,
	"prescription_date" text NOT NULL,
	"chief_complaints" text,
	"clinical_findings" text,
	"diagnosis" text,
	"treatment_plan" text,
	"show_plan_costs" boolean DEFAULT true NOT NULL,
	"sync_to_patient_records" boolean DEFAULT true NOT NULL,
	"follow_up_date" text,
	"oral_hygiene_instructions" text,
	"tooth_brushing_instructions" text,
	"mouthwash_recommendations" text,
	"post_extraction_instructions" text,
	"post_treatment_precautions" text,
	"dietary_recommendations" text,
	"additional_clinical_advice" text,
	"idempotency_key" text UNIQUE,
	"finalized_at" timestamp,
	"finalized_by" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "salary_adjustments" (
	"id" serial PRIMARY KEY,
	"salary_id" integer NOT NULL,
	"doctor_id" integer NOT NULL,
	"adjustment_type" text NOT NULL,
	"amount" numeric(12,2) NOT NULL,
	"previous_payable" numeric(12,2) NOT NULL,
	"new_payable" numeric(12,2) NOT NULL,
	"reason" text NOT NULL,
	"authorized_by" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "salary_payments" (
	"id" serial PRIMARY KEY,
	"payment_code" text NOT NULL UNIQUE,
	"salary_id" integer NOT NULL,
	"doctor_id" integer NOT NULL,
	"amount" numeric(12,2) NOT NULL,
	"payment_date" text NOT NULL,
	"payment_method" text DEFAULT 'Cash' NOT NULL,
	"transaction_ref" text,
	"notes" text,
	"recorded_by" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subscription_audit_logs" (
	"id" serial PRIMARY KEY,
	"user_id" integer,
	"user_role" text NOT NULL,
	"action" text NOT NULL,
	"target_key" text NOT NULL,
	"previous_state_json" text,
	"new_state_json" text,
	"details" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subscription_packages" (
	"id" serial PRIMARY KEY,
	"package_key" text NOT NULL UNIQUE,
	"package_name" text NOT NULL,
	"description" text,
	"monthly_price_bdt" numeric(12,2) DEFAULT '0' NOT NULL,
	"annual_price_bdt" numeric(12,2) DEFAULT '0' NOT NULL,
	"feature_entitlements_json" text DEFAULT '{}' NOT NULL,
	"limits_json" text DEFAULT '{}' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"updated_by" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" serial PRIMARY KEY,
	"key" text NOT NULL UNIQUE,
	"value" text NOT NULL,
	"description" text,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "treatments" (
	"id" serial PRIMARY KEY,
	"visit_id" integer NOT NULL,
	"patient_id" integer NOT NULL,
	"doctor_id" integer NOT NULL,
	"source_prescription_id" integer,
	"treatment_name" text NOT NULL,
	"description" text,
	"tooth_number" text,
	"cost" numeric(12,2) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'Completed' NOT NULL,
	"notes" text,
	"treatment_date" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY,
	"uid" text UNIQUE,
	"username" text NOT NULL UNIQUE,
	"password_hash" text,
	"email" text,
	"full_name" text NOT NULL,
	"role" text DEFAULT 'doctor' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"phone" text,
	"specialization" text,
	"qualifications" text,
	"registration_number" text,
	"joining_date" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "visits" (
	"id" serial PRIMARY KEY,
	"visit_id" text NOT NULL UNIQUE,
	"patient_id" integer NOT NULL,
	"doctor_id" integer NOT NULL,
	"visit_date" text NOT NULL,
	"visit_time" text,
	"complaints" text,
	"diagnosis" text,
	"notes" text,
	"next_follow_up_date" text,
	"total_treatment_cost" numeric(12,2) DEFAULT '0' NOT NULL,
	"total_test_cost" numeric(12,2) DEFAULT '0' NOT NULL,
	"additional_charges" numeric(12,2) DEFAULT '0' NOT NULL,
	"discount" numeric(12,2) DEFAULT '0' NOT NULL,
	"total_cost" numeric(12,2) DEFAULT '0' NOT NULL,
	"amount_paid" numeric(12,2) DEFAULT '0' NOT NULL,
	"outstanding_due" numeric(12,2) DEFAULT '0' NOT NULL,
	"status" text DEFAULT 'Completed' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "idx_appointments_patient_id" ON "appointments" ("patient_id");--> statement-breakpoint
CREATE INDEX "idx_appointments_visit_id" ON "appointments" ("visit_id");--> statement-breakpoint
CREATE INDEX "idx_appointments_doctor_id" ON "appointments" ("doctor_id");--> statement-breakpoint
CREATE INDEX "idx_appointments_date" ON "appointments" ("follow_up_date");--> statement-breakpoint
CREATE INDEX "idx_appointments_status" ON "appointments" ("status");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_created_at" ON "audit_logs" ("created_at");--> statement-breakpoint
CREATE INDEX "idx_audit_logs_user_id" ON "audit_logs" ("user_id");--> statement-breakpoint
CREATE INDEX "idx_backup_history_user" ON "backup_history_logs" ("requested_by");--> statement-breakpoint
CREATE INDEX "idx_backup_history_doc_scope" ON "backup_history_logs" ("doctor_scope_id");--> statement-breakpoint
CREATE INDEX "idx_backup_history_created" ON "backup_history_logs" ("created_at");--> statement-breakpoint
CREATE INDEX "idx_diagnostic_tests_visit_id" ON "diagnostic_tests" ("visit_id");--> statement-breakpoint
CREATE INDEX "idx_diagnostic_tests_patient_id" ON "diagnostic_tests" ("patient_id");--> statement-breakpoint
CREATE INDEX "idx_diagnostic_tests_doctor_id" ON "diagnostic_tests" ("doctor_id");--> statement-breakpoint
CREATE INDEX "idx_diagnostic_tests_date" ON "diagnostic_tests" ("test_date");--> statement-breakpoint
CREATE INDEX "idx_diagnostic_tests_source_rx" ON "diagnostic_tests" ("source_prescription_id");--> statement-breakpoint
CREATE INDEX "idx_doctor_clinical_headings_doc_id" ON "doctor_clinical_headings" ("doctor_id");--> statement-breakpoint
CREATE INDEX "idx_doctor_salaries_doctor_id" ON "doctor_salaries" ("doctor_id");--> statement-breakpoint
CREATE INDEX "idx_doctor_salaries_type" ON "doctor_salaries" ("salary_type");--> statement-breakpoint
CREATE INDEX "idx_doctor_salaries_payment_date" ON "doctor_salaries" ("payment_date");--> statement-breakpoint
CREATE INDEX "idx_doctor_salaries_status" ON "doctor_salaries" ("payment_status");--> statement-breakpoint
CREATE INDEX "idx_doctor_salaries_payroll_month" ON "doctor_salaries" ("payroll_month");--> statement-breakpoint
CREATE INDEX "idx_doc_salary_struct_hist_doc" ON "doctor_salary_structure_history" ("doctor_id");--> statement-breakpoint
CREATE INDEX "idx_doc_salary_struct_doctor" ON "doctor_salary_structures" ("doctor_id");--> statement-breakpoint
CREATE INDEX "idx_doc_salary_struct_type" ON "doctor_salary_structures" ("salary_type");--> statement-breakpoint
CREATE INDEX "idx_medicine_audit_med_id" ON "medicine_audit_logs" ("medicine_id");--> statement-breakpoint
CREATE INDEX "idx_medicine_audit_batch_id" ON "medicine_audit_logs" ("import_batch_id");--> statement-breakpoint
CREATE INDEX "idx_medicines_norm_brand" ON "medicines" ("norm_brand");--> statement-breakpoint
CREATE INDEX "idx_medicines_norm_generic" ON "medicines" ("norm_generic");--> statement-breakpoint
CREATE INDEX "idx_medicines_norm_strength" ON "medicines" ("norm_strength");--> statement-breakpoint
CREATE INDEX "idx_medicines_norm_dosage" ON "medicines" ("norm_dosage_type");--> statement-breakpoint
CREATE INDEX "idx_medicines_norm_mfg" ON "medicines" ("norm_manufacturer");--> statement-breakpoint
CREATE INDEX "idx_medicines_clinical_key" ON "medicines" ("clinical_key");--> statement-breakpoint
CREATE INDEX "idx_medicines_active" ON "medicines" ("is_active");--> statement-breakpoint
CREATE INDEX "idx_patients_name" ON "patients" ("name");--> statement-breakpoint
CREATE INDEX "idx_patients_phone" ON "patients" ("phone");--> statement-breakpoint
CREATE INDEX "idx_patients_reg_date" ON "patients" ("registration_date");--> statement-breakpoint
CREATE INDEX "idx_payments_visit_id" ON "payments" ("visit_id");--> statement-breakpoint
CREATE INDEX "idx_payments_patient_id" ON "payments" ("patient_id");--> statement-breakpoint
CREATE INDEX "idx_payments_received_by" ON "payments" ("received_by");--> statement-breakpoint
CREATE INDEX "idx_payments_payment_date" ON "payments" ("payment_date");--> statement-breakpoint
CREATE INDEX "idx_payroll_audit_salary" ON "payroll_audit_logs" ("salary_id");--> statement-breakpoint
CREATE INDEX "idx_payroll_audit_doctor" ON "payroll_audit_logs" ("doctor_id");--> statement-breakpoint
CREATE INDEX "idx_rx_advised_tests_rx_id" ON "prescription_advised_tests" ("prescription_id");--> statement-breakpoint
CREATE INDEX "idx_rx_custom_sections_rx_id" ON "prescription_custom_sections" ("prescription_id");--> statement-breakpoint
CREATE INDEX "idx_prescription_medicines_rx_id" ON "prescription_medicines" ("prescription_id");--> statement-breakpoint
CREATE INDEX "idx_prescription_medicines_med_id" ON "prescription_medicines" ("medicine_id");--> statement-breakpoint
CREATE INDEX "idx_prescription_medicines_name" ON "prescription_medicines" ("medicine_name");--> statement-breakpoint
CREATE INDEX "idx_rx_treatment_plans_rx_id" ON "prescription_treatment_plans" ("prescription_id");--> statement-breakpoint
CREATE INDEX "idx_prescriptions_patient_id" ON "prescriptions" ("patient_id");--> statement-breakpoint
CREATE INDEX "idx_prescriptions_doctor_id" ON "prescriptions" ("doctor_id");--> statement-breakpoint
CREATE INDEX "idx_prescriptions_visit_id" ON "prescriptions" ("visit_id");--> statement-breakpoint
CREATE INDEX "idx_prescriptions_date" ON "prescriptions" ("prescription_date");--> statement-breakpoint
CREATE INDEX "idx_prescriptions_status" ON "prescriptions" ("status");--> statement-breakpoint
CREATE INDEX "idx_salary_adjustments_salary_id" ON "salary_adjustments" ("salary_id");--> statement-breakpoint
CREATE INDEX "idx_salary_payments_salary_id" ON "salary_payments" ("salary_id");--> statement-breakpoint
CREATE INDEX "idx_salary_payments_doctor_id" ON "salary_payments" ("doctor_id");--> statement-breakpoint
CREATE INDEX "idx_salary_payments_date" ON "salary_payments" ("payment_date");--> statement-breakpoint
CREATE INDEX "idx_treatments_visit_id" ON "treatments" ("visit_id");--> statement-breakpoint
CREATE INDEX "idx_treatments_patient_id" ON "treatments" ("patient_id");--> statement-breakpoint
CREATE INDEX "idx_treatments_doctor_id" ON "treatments" ("doctor_id");--> statement-breakpoint
CREATE INDEX "idx_treatments_date" ON "treatments" ("treatment_date");--> statement-breakpoint
CREATE INDEX "idx_treatments_source_rx" ON "treatments" ("source_prescription_id");--> statement-breakpoint
CREATE INDEX "idx_visits_patient_id" ON "visits" ("patient_id");--> statement-breakpoint
CREATE INDEX "idx_visits_doctor_id" ON "visits" ("doctor_id");--> statement-breakpoint
CREATE INDEX "idx_visits_visit_date" ON "visits" ("visit_date");--> statement-breakpoint
CREATE INDEX "idx_visits_patient_chrono" ON "visits" ("patient_id","visit_date","id");--> statement-breakpoint
ALTER TABLE "application_feature_flags" ADD CONSTRAINT "application_feature_flags_updated_by_users_id_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_patients_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id");--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_visit_id_visits_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id");--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctor_id_users_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "backup_history_logs" ADD CONSTRAINT "backup_history_logs_requested_by_users_id_fkey" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "clinic_subscriptions" ADD CONSTRAINT "clinic_subscriptions_package_id_subscription_packages_id_fkey" FOREIGN KEY ("package_id") REFERENCES "subscription_packages"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "clinic_subscriptions" ADD CONSTRAINT "clinic_subscriptions_assigned_by_users_id_fkey" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "diagnostic_tests" ADD CONSTRAINT "diagnostic_tests_visit_id_visits_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id");--> statement-breakpoint
ALTER TABLE "diagnostic_tests" ADD CONSTRAINT "diagnostic_tests_patient_id_patients_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id");--> statement-breakpoint
ALTER TABLE "diagnostic_tests" ADD CONSTRAINT "diagnostic_tests_doctor_id_users_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "doctor_clinical_headings" ADD CONSTRAINT "doctor_clinical_headings_doctor_id_users_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "doctor_salaries" ADD CONSTRAINT "doctor_salaries_doctor_id_users_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "doctor_salaries" ADD CONSTRAINT "doctor_salaries_finalized_by_users_id_fkey" FOREIGN KEY ("finalized_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "doctor_salaries" ADD CONSTRAINT "doctor_salaries_recorded_by_users_id_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "doctor_salary_structure_history" ADD CONSTRAINT "doctor_salary_structure_history_bTjeJEKr1kOt_fkey" FOREIGN KEY ("structure_id") REFERENCES "doctor_salary_structures"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "doctor_salary_structure_history" ADD CONSTRAINT "doctor_salary_structure_history_doctor_id_users_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "doctor_salary_structure_history" ADD CONSTRAINT "doctor_salary_structure_history_changed_by_users_id_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "doctor_salary_structures" ADD CONSTRAINT "doctor_salary_structures_doctor_id_users_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "doctor_salary_structures" ADD CONSTRAINT "doctor_salary_structures_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "doctor_salary_structures" ADD CONSTRAINT "doctor_salary_structures_updated_by_users_id_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "medicine_audit_logs" ADD CONSTRAINT "medicine_audit_logs_medicine_id_medicines_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "medicines"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "medicine_audit_logs" ADD CONSTRAINT "medicine_audit_logs_hxxtWPAWWIAN_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "medicine_import_batches"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "medicine_audit_logs" ADD CONSTRAINT "medicine_audit_logs_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "medicine_catalog_snapshots" ADD CONSTRAINT "medicine_catalog_snapshots_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "medicine_import_batches" ADD CONSTRAINT "medicine_import_batches_uploaded_by_users_id_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "medicine_import_batches" ADD CONSTRAINT "medicine_import_batches_nfG894X2JxF1_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "medicine_catalog_snapshots"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "medicines" ADD CONSTRAINT "medicines_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "medicines" ADD CONSTRAINT "medicines_updated_by_users_id_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_patient_id_patients_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_visit_id_visits_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id");--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_received_by_users_id_fkey" FOREIGN KEY ("received_by") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "payroll_audit_logs" ADD CONSTRAINT "payroll_audit_logs_salary_id_doctor_salaries_id_fkey" FOREIGN KEY ("salary_id") REFERENCES "doctor_salaries"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "payroll_audit_logs" ADD CONSTRAINT "payroll_audit_logs_doctor_id_users_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "payroll_audit_logs" ADD CONSTRAINT "payroll_audit_logs_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "prescription_advised_tests" ADD CONSTRAINT "prescription_advised_tests_5YtNgnlu08Ee_fkey" FOREIGN KEY ("prescription_id") REFERENCES "prescriptions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "prescription_audit_logs" ADD CONSTRAINT "prescription_audit_logs_prescription_id_prescriptions_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "prescriptions"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "prescription_audit_logs" ADD CONSTRAINT "prescription_audit_logs_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "prescription_custom_sections" ADD CONSTRAINT "prescription_custom_sections_PxIRNOLq25gS_fkey" FOREIGN KEY ("prescription_id") REFERENCES "prescriptions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "prescription_medicines" ADD CONSTRAINT "prescription_medicines_prescription_id_prescriptions_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "prescriptions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "prescription_medicines" ADD CONSTRAINT "prescription_medicines_medicine_id_medicines_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "medicines"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "prescription_revisions" ADD CONSTRAINT "prescription_revisions_prescription_id_prescriptions_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "prescriptions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "prescription_revisions" ADD CONSTRAINT "prescription_revisions_oiTFqBalalEa_fkey" FOREIGN KEY ("previous_prescription_id") REFERENCES "prescriptions"("id");--> statement-breakpoint
ALTER TABLE "prescription_revisions" ADD CONSTRAINT "prescription_revisions_created_by_users_id_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "prescription_treatment_plans" ADD CONSTRAINT "prescription_treatment_plans_V3D6uAB43XvD_fkey" FOREIGN KEY ("prescription_id") REFERENCES "prescriptions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_patient_id_patients_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id");--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_doctor_id_users_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_visit_id_visits_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id");--> statement-breakpoint
ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_finalized_by_users_id_fkey" FOREIGN KEY ("finalized_by") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "salary_adjustments" ADD CONSTRAINT "salary_adjustments_salary_id_doctor_salaries_id_fkey" FOREIGN KEY ("salary_id") REFERENCES "doctor_salaries"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "salary_adjustments" ADD CONSTRAINT "salary_adjustments_doctor_id_users_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "salary_adjustments" ADD CONSTRAINT "salary_adjustments_authorized_by_users_id_fkey" FOREIGN KEY ("authorized_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "salary_payments" ADD CONSTRAINT "salary_payments_salary_id_doctor_salaries_id_fkey" FOREIGN KEY ("salary_id") REFERENCES "doctor_salaries"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "salary_payments" ADD CONSTRAINT "salary_payments_doctor_id_users_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "salary_payments" ADD CONSTRAINT "salary_payments_recorded_by_users_id_fkey" FOREIGN KEY ("recorded_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "subscription_audit_logs" ADD CONSTRAINT "subscription_audit_logs_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "subscription_packages" ADD CONSTRAINT "subscription_packages_updated_by_users_id_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "treatments" ADD CONSTRAINT "treatments_visit_id_visits_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "visits"("id");--> statement-breakpoint
ALTER TABLE "treatments" ADD CONSTRAINT "treatments_patient_id_patients_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id");--> statement-breakpoint
ALTER TABLE "treatments" ADD CONSTRAINT "treatments_doctor_id_users_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_patient_id_patients_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id");--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_doctor_id_users_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "users"("id");