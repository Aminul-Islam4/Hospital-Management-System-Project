import bcrypt from 'bcryptjs';
import { db } from './index.ts';
import {
  users,
  patients,
  visits,
  treatments,
  diagnosticTests,
  payments,
  appointments,
  auditLogs,
  systemSettings,
} from './schema.ts';
import { count, eq, inArray, asc } from 'drizzle-orm';

async function reconcileExistingPatientBalances() {
  try {
    const allPatients = await db.select().from(patients);
    for (const pat of allPatients) {
      const pVisits = await db
        .select()
        .from(visits)
        .where(eq(visits.patientId, pat.id))
        .orderBy(asc(visits.visitDate), asc(visits.id));
      if (pVisits.length <= 1) continue;

      let runningDue = 0;
      for (let i = 0; i < pVisits.length; i++) {
        const v = pVisits[i];
        const isLatest = i === pVisits.length - 1;
        const netCost = parseFloat(v.totalCost || '0');
        const paid = parseFloat(v.amountPaid || '0');
        runningDue = Math.max(0, Number((runningDue + netCost - paid).toFixed(2)));
        const targetOutstanding = isLatest ? runningDue.toFixed(2) : '0.00';
        if (v.outstandingDue !== targetOutstanding) {
          await db
            .update(visits)
            .set({ outstandingDue: targetOutstanding })
            .where(eq(visits.id, v.id));
        }
      }
    }
  } catch (e) {
    console.error('Error reconciling patient balances:', e);
  }
}

export async function seedInitialData() {
  try {
    const existingUsers = await db.select({ count: count() }).from(users);
    if (Number(existingUsers[0]?.count) > 0) {
      await db
        .update(patients)
        .set({ notes: null })
        .where(
          inArray(patients.notes, [
            'Needs fasting glucose check before surgical extractions.',
            'Routine dental consultation.',
            'Referred by friend. Very compliant patient.',
            'Chief complaint of bleeding gums during brushing.',
          ])
        );
      await reconcileExistingPatientBalances();
      console.log('Database already initialized with users.');
      return;
    }

    console.log('Seeding initial clinic users and test scenario...');

    const salt = bcrypt.genSaltSync(10);
    const mainDoctorPass = bcrypt.hashSync('ClinicAdmin@2026', salt);
    const devPass = bcrypt.hashSync('DevDental@2026', salt);
    const doctorPass = bcrypt.hashSync('Doctor@123', salt);

    // 1. Create Users
    const [uMain] = await db
      .insert(users)
      .values({
        username: 'maindoctor',
        passwordHash: mainDoctorPass,
        email: 'dr.rahman@dhakadentalcare.com',
        fullName: 'Prof. Dr. Kazi M. Rahman',
        role: 'main_doctor',
        isActive: true,
        phone: '+880 1711-234567',
        specialization: 'Senior Consultant & Prosthodontist',
        qualifications: 'BDS, FCPS (Oral & Maxillofacial Surgery), PhD (Tokyo)',
        joiningDate: '2020-01-15',
      })
      .returning();

    const [uDev] = await db
      .insert(users)
      .values({
        username: 'dev_admin',
        passwordHash: devPass,
        email: 'developer@dhakadentalcare.com',
        fullName: 'Farhan Ahmed (Lead Developer)',
        role: 'developer',
        isActive: true,
        phone: '+880 1819-987654',
        specialization: 'Full Stack & Database Architect',
        qualifications: 'B.Sc. in Computer Science & Engineering',
        joiningDate: '2022-06-01',
      })
      .returning();

    const [uDocA] = await db
      .insert(users)
      .values({
        username: 'dr_rahim',
        passwordHash: doctorPass,
        email: 'dr.rahim@dhakadentalcare.com',
        fullName: 'Dr. Rahim Chowdhury',
        role: 'doctor',
        isActive: true,
        phone: '+880 1912-345678',
        specialization: 'General Dental Surgeon & Implantologist',
        qualifications: 'BDS (Dhaka Dental College), PGT (Operative)',
        joiningDate: '2023-03-10',
      })
      .returning();

    const [uDocB] = await db
      .insert(users)
      .values({
        username: 'dr_fatima',
        passwordHash: doctorPass,
        email: 'dr.fatima@dhakadentalcare.com',
        fullName: 'Dr. Fatima Akter',
        role: 'doctor',
        isActive: true,
        phone: '+880 1612-876543',
        specialization: 'Endodontist & Conservative Dentistry',
        qualifications: 'BDS (Chittagong Medical College), MS (Endodontics)',
        joiningDate: '2023-08-01',
      })
      .returning();

    const [uDocC] = await db
      .insert(users)
      .values({
        username: 'dr_tariq',
        passwordHash: doctorPass,
        email: 'dr.tariq@dhakadentalcare.com',
        fullName: 'Dr. Tariqul Islam',
        role: 'doctor',
        isActive: true,
        phone: '+880 1515-432109',
        specialization: 'Orthodontics & Dentofacial Orthopedics',
        qualifications: 'BDS, FCPS (Orthodontics Part-II), MPH',
        joiningDate: '2024-01-10',
      })
      .returning();

    // 2. Default System Settings & Treatment Pricing
    await db.insert(systemSettings).values([
      { key: 'clinic_name', value: 'Dhaka Dental Care & Implant Center', description: 'Name of the dental clinic' },
      { key: 'clinic_address', value: 'House 42, Road 11, Banani, Dhaka-1213, Bangladesh', description: 'Clinic location' },
      { key: 'clinic_phone', value: '+880 2-9876543, +880 1711-234567', description: 'Contact phone' },
      { key: 'clinic_currency', value: 'BDT (৳)', description: 'Default currency' },
      {
        key: 'default_treatment_prices',
        value: JSON.stringify([
          { name: 'Dental Examination & Consultation', category: 'General', defaultCost: 500 },
          { name: 'Composite Dental Filling (Per Tooth)', category: 'Restorative', defaultCost: 1500 },
          { name: 'Root Canal Treatment (RCT - Molar)', category: 'Endodontics', defaultCost: 5000 },
          { name: 'Root Canal Treatment (RCT - Anterior)', category: 'Endodontics', defaultCost: 3500 },
          { name: 'Tooth Extraction (Simple)', category: 'Surgery', defaultCost: 1200 },
          { name: 'Surgical Disimpaction (Wisdom Tooth)', category: 'Surgery', defaultCost: 6000 },
          { name: 'Ultrasonic Scaling & Polishing (Full Mouth)', category: 'Preventive', defaultCost: 2000 },
          { name: 'Porcelain Fused to Metal (PFM) Crown', category: 'Prosthodontics', defaultCost: 4500 },
          { name: 'All-Ceramic Zirconia Crown', category: 'Prosthodontics', defaultCost: 8500 },
          { name: 'Dental Implant (Titanium Fixture + Abutment)', category: 'Implant', defaultCost: 45000 },
          { name: 'Orthodontic Consultation & Analysis', category: 'Orthodontics', defaultCost: 2000 },
          { name: 'Gingivectomy / Periodontal Flap', category: 'Periodontics', defaultCost: 4000 },
        ]),
        description: 'Standard treatment pricing list',
      },
      {
        key: 'default_test_prices',
        value: JSON.stringify([
          { name: 'Intraoral Periapical Radiograph (IOPA)', category: 'IOPA', defaultCost: 300 },
          { name: 'Orthopantomogram (OPG - Full Mouth Panoramic)', category: 'OPG', defaultCost: 1200 },
          { name: 'Dental Cone Beam CT (CBCT - Single Jaw)', category: 'CBCT', defaultCost: 3500 },
          { name: 'Bite-wing X-ray', category: 'Dental X-ray', defaultCost: 400 },
          { name: 'Blood Glucose Test (Random)', category: 'Other', defaultCost: 200 },
        ]),
        description: 'Standard diagnostic test and radiograph pricing list',
      },
    ]);

    // 3. Seed Sample Patients
    // Patient 1: Tanvir Hasan (Demonstrates the mandatory multi-doctor scenario: Doc A -> Doc B -> Doc C)
    const [p1] = await db
      .insert(patients)
      .values({
        patientId: 'DP-1001',
        name: 'Tanvir Hasan',
        phone: '01712345678',
        altPhone: '01898765432',
        age: 34,
        gender: 'Male',
        address: 'House 14, Road 4, Sector 7, Uttara, Dhaka',
        registrationDate: '2026-10-10',
        medicalHistory: 'Mild Hypertension (controlled on Amlodipine 5mg). No bleeding disorder.',
        allergies: 'Penicillin allergy (develops urticaria)',
        existingDiseases: 'Hypertension',
        notes: null,
        createdBy: uDocA.id,
      })
      .returning();

    // Patient 2: Nasrin Sultana
    const [p2] = await db
      .insert(patients)
      .values({
        patientId: 'DP-1002',
        name: 'Nasrin Sultana',
        phone: '01987654321',
        altPhone: '01755443322',
        age: 28,
        gender: 'Female',
        address: 'Block C, Lalmatia, Dhaka',
        registrationDate: '2026-10-18',
        medicalHistory: null,
        allergies: null,
        existingDiseases: null,
        notes: null,
        createdBy: uDocB.id,
      })
      .returning();

    // Patient 3: Md. Kabir Hossain
    const [p3] = await db
      .insert(patients)
      .values({
        patientId: 'DP-1003',
        name: 'Md. Kabir Hossain',
        phone: '01812334455',
        age: 52,
        gender: 'Male',
        address: 'Mirpur-10, Dhaka',
        registrationDate: '2026-10-22',
        medicalHistory: null,
        allergies: null,
        existingDiseases: null,
        notes: null,
        createdBy: uDocC.id,
      })
      .returning();

    // 4. Seed the Mandatory Scenario for Patient 1 (Tanvir Hasan):
    // Visit 1: Doctor A (Dr. Rahim) - Exam, IOPA X-ray, Diagnosis of Irreversible Pulpitis
    const [v1] = await db
      .insert(visits)
      .values({
        visitId: 'VST-1001',
        patientId: p1.id,
        doctorId: uDocA.id,
        visitDate: '2026-10-10',
        visitTime: '11:30',
        complaints: 'Severe throbbing pain in lower left molar (tooth #36), aggravated by cold and night pain.',
        diagnosis: 'Acute Irreversible Pulpitis on #36 with symptomatic apical periodontitis',
        notes: 'Advised emergency pulp extirpation and referral to Endodontist Dr. Fatima for RCT.',
        nextFollowUpDate: '2026-10-15',
        totalTreatmentCost: '1000.00',
        totalTestCost: '300.00',
        additionalCharges: '0.00',
        discount: '0.00',
        totalCost: '1300.00',
        amountPaid: '1300.00',
        outstandingDue: '0.00',
        status: 'Completed',
      })
      .returning();

    // Treatment in Visit 1
    await db.insert(treatments).values({
      visitId: v1.id,
      patientId: p1.id,
      doctorId: uDocA.id,
      treatmentName: 'Emergency Pulp Extirpation & Dressing',
      description: 'Opened canal orifice, extirpated pulp under local anesthesia, placed Ca(OH)2 dressing and temporary seal.',
      toothNumber: '36',
      cost: '1000.00',
      status: 'Completed',
      notes: 'Patient relieved of acute pain.',
      treatmentDate: '2026-10-10',
    });

    // Test in Visit 1
    await db.insert(diagnosticTests).values({
      visitId: v1.id,
      patientId: p1.id,
      doctorId: uDocA.id,
      testName: 'Intraoral Periapical Radiograph (IOPA)',
      category: 'IOPA',
      description: 'Pre-op IOPA of tooth #36 showing deep occlusal decay reaching pulp chamber.',
      cost: '300.00',
      status: 'Completed',
      notes: 'Roots are curved at apical third.',
      testDate: '2026-10-10',
    });

    // Payment for Visit 1
    await db.insert(payments).values({
      paymentId: 'PAY-1001',
      patientId: p1.id,
      visitId: v1.id,
      amount: '1300.00',
      paymentMethod: 'Cash',
      transactionRef: 'CSH-1001',
      notes: 'Full payment received at counter by Dr. Rahim.',
      receivedBy: uDocA.id,
      paymentDate: '2026-10-10',
    });

    // Visit 2: Doctor B (Dr. Fatima) - Seeing the same patient, reviewing Doctor A's notes, doing RCT
    const [v2] = await db
      .insert(visits)
      .values({
        visitId: 'VST-1002',
        patientId: p1.id,
        doctorId: uDocB.id,
        visitDate: '2026-10-15',
        visitTime: '15:00',
        complaints: 'Follow-up for Root Canal Completion. Pain is gone, temporary filling intact.',
        diagnosis: 'Tooth #36 undergoing multi-visit RCT, canals clean and dry.',
        notes: 'Cleaned and shaped 3 canals (MB, ML, Distal). Master cone radiograph taken. Obturation completed with gutta-percha and AH Plus sealer.',
        nextFollowUpDate: '2026-10-25',
        totalTreatmentCost: '5000.00',
        totalTestCost: '600.00',
        additionalCharges: '0.00',
        discount: '600.00',
        totalCost: '5000.00',
        amountPaid: '3000.00',
        outstandingDue: '0.00',
        status: 'Completed',
      })
      .returning();

    // Treatment in Visit 2
    await db.insert(treatments).values({
      visitId: v2.id,
      patientId: p1.id,
      doctorId: uDocB.id,
      treatmentName: 'Root Canal Treatment (Molar - 3 Canals)',
      description: 'Biomechanical preparation, irrigation with 3% NaOCl & EDTA, warm vertical compaction obturation.',
      toothNumber: '36',
      cost: '5000.00',
      status: 'Completed',
      notes: 'Core build-up with composite done.',
      treatmentDate: '2026-10-15',
    });

    // Tests in Visit 2 (2 radiographs: working length and post-obturation)
    await db.insert(diagnosticTests).values([
      {
        visitId: v2.id,
        patientId: p1.id,
        doctorId: uDocB.id,
        testName: 'IOPA Radiograph (Working Length)',
        category: 'IOPA',
        description: 'Working length determination of #36 MB, ML, and Distal canals.',
        cost: '300.00',
        status: 'Completed',
        notes: 'MB: 21mm, ML: 20.5mm, D: 21.5mm',
        testDate: '2026-10-15',
      },
      {
        visitId: v2.id,
        patientId: p1.id,
        doctorId: uDocB.id,
        testName: 'IOPA Radiograph (Post-Obturation)',
        category: 'IOPA',
        description: 'Post-obturation check showing dense hermetic seal to radiographic apex.',
        cost: '300.00',
        status: 'Completed',
        notes: 'Satisfactory seal. Patient advised to get crown.',
        testDate: '2026-10-15',
      },
    ]);

    // Partial Payment 1 for Visit 2 (bKash ৳3000)
    await db.insert(payments).values({
      paymentId: 'PAY-1002',
      patientId: p1.id,
      visitId: v2.id,
      amount: '3000.00',
      paymentMethod: 'bKash',
      transactionRef: 'BK-9A7B318F',
      notes: 'Partial payment received via bKash. Remaining due: ৳2,000.',
      receivedBy: uDocB.id,
      paymentDate: '2026-10-15',
    });

    // Visit 3: Doctor C (Dr. Tariq) - Seeing patient for Crown preparation and OPG review
    const [v3] = await db
      .insert(visits)
      .values({
        visitId: 'VST-1003',
        patientId: p1.id,
        doctorId: uDocC.id,
        visitDate: '2026-10-25',
        visitTime: '17:30',
        complaints: 'Referred by Dr. Fatima for crown preparation of #36 and overall occlusion evaluation.',
        diagnosis: 'Tooth #36 RCT-treated, requires full coverage Zirconia crown. Mild anterior crowding.',
        notes: 'Tooth preparation completed with deep chamfer margin. Impression taken with polyether and sent to laboratory. Temporary crown cemented.',
        nextFollowUpDate: '2026-11-02',
        totalTreatmentCost: '8500.00',
        totalTestCost: '1200.00',
        additionalCharges: '300.00',
        discount: '1000.00',
        totalCost: '9000.00',
        amountPaid: '5000.00',
        outstandingDue: '6000.00',
        status: 'Completed',
      })
      .returning();

    // Treatment in Visit 3
    await db.insert(treatments).values({
      visitId: v3.id,
      patientId: p1.id,
      doctorId: uDocC.id,
      treatmentName: 'All-Ceramic Zirconia Crown (Tooth #36)',
      description: 'Full tooth preparation, gingival retraction, double-mix impression, provisional crown cementation.',
      toothNumber: '36',
      cost: '8500.00',
      status: 'Ongoing',
      notes: 'Lab order dispatched to Modern Dental Lab.',
      treatmentDate: '2026-10-25',
    });

    // Diagnostic Test in Visit 3 (OPG)
    await db.insert(diagnosticTests).values({
      visitId: v3.id,
      patientId: p1.id,
      doctorId: uDocC.id,
      testName: 'Orthopantomogram (OPG - Full Panoramic)',
      category: 'OPG',
      description: 'Full mouth panoramic radiograph to evaluate general alveolar bone and TMJ.',
      cost: '1200.00',
      status: 'Completed',
      notes: 'General bone levels within normal limits.',
      testDate: '2026-10-25',
    });

    // Payment for Visit 3 (Cash ৳5000)
    await db.insert(payments).values({
      paymentId: 'PAY-1003',
      patientId: p1.id,
      visitId: v3.id,
      amount: '5000.00',
      paymentMethod: 'Cash',
      transactionRef: 'CSH-1002',
      notes: 'Advance crown payment received. Remaining visit due: ৳4,000.',
      receivedBy: uDocC.id,
      paymentDate: '2026-10-25',
    });

    // Follow-up for Patient 1
    await db.insert(appointments).values({
      patientId: p1.id,
      visitId: v3.id,
      doctorId: uDocC.id,
      followUpDate: '2026-11-02',
      reason: 'Permanent Zirconia Crown Trial & Cementation',
      status: 'Scheduled',
      notes: 'Verify bite and contact points before final resin cementation.',
    });

    // Patient 2 Visits & Payments (Scaling with Dr. Fatima)
    const [v4] = await db
      .insert(visits)
      .values({
        visitId: 'VST-1004',
        patientId: p2.id,
        doctorId: uDocB.id,
        visitDate: '2026-10-18',
        visitTime: '10:00',
        complaints: 'Gingival bleeding and calculus buildup.',
        diagnosis: 'Generalized Chronic Marginal Gingivitis with subgingival calculus',
        notes: 'Full mouth ultrasonic scaling and subgingival curettage done. Chlorhexidine mouthwash prescribed.',
        nextFollowUpDate: '2026-11-18',
        totalTreatmentCost: '2000.00',
        totalTestCost: '0.00',
        additionalCharges: '0.00',
        discount: '0.00',
        totalCost: '2000.00',
        amountPaid: '2000.00',
        outstandingDue: '0.00',
        status: 'Completed',
      })
      .returning();

    await db.insert(treatments).values({
      visitId: v4.id,
      patientId: p2.id,
      doctorId: uDocB.id,
      treatmentName: 'Ultrasonic Scaling & Polishing (Full Mouth)',
      description: 'Supragingival and subgingival ultrasonic scaling with polishing paste.',
      cost: '2000.00',
      status: 'Completed',
      treatmentDate: '2026-10-18',
    });

    await db.insert(payments).values({
      paymentId: 'PAY-1004',
      patientId: p2.id,
      visitId: v4.id,
      amount: '2000.00',
      paymentMethod: 'Nagad',
      transactionRef: 'NGD-882199',
      notes: 'Full payment cleared via Nagad.',
      receivedBy: uDocB.id,
      paymentDate: '2026-10-18',
    });

    // 5. Audit Log Initial Records
    await db.insert(auditLogs).values([
      {
        userId: uDev.id,
        userRole: 'developer',
        action: 'SYSTEM_INITIALIZATION',
        affectedRecord: 'System Settings',
        details: 'Initial clinic database schema, pricing, and default doctor accounts configured.',
      },
      {
        userId: uDocA.id,
        userRole: 'doctor',
        action: 'CREATE_PATIENT',
        affectedRecord: 'Patient DP-1001 (Tanvir Hasan)',
        details: 'Registered new patient with severe dental pain.',
      },
      {
        userId: uDocB.id,
        userRole: 'doctor',
        action: 'CREATE_VISIT',
        affectedRecord: 'Visit VST-1002 (Patient DP-1001)',
        details: 'Added root canal treatment session following referral from Dr. Rahim.',
      },
      {
        userId: uDocC.id,
        userRole: 'doctor',
        action: 'CREATE_VISIT',
        affectedRecord: 'Visit VST-1003 (Patient DP-1001)',
        details: 'Added crown preparation visit under shared patient profile.',
      },
    ]);

    console.log('Database seeding successfully finished!');
  } catch (error) {
    console.error('Error during database seed:', error);
  }
}
