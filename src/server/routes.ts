import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/index.ts';
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
} from '../db/schema.ts';
import {
  authenticateToken,
  requireRoles,
  generateToken,
  logAudit,
  AuthenticatedRequest,
} from './auth.ts';
import { eq, desc, asc, and, or, sql, like, inArray, count } from 'drizzle-orm';

export const apiRouter = Router();

export interface VisitFinancialSnapshot {
  visitId: number;
  visitCode: string;
  treatmentCost: number;
  testCost: number;
  additionalCharges: number;
  discount: number;
  totalCost: number; // This visit's net bill (Treatments + Tests + Additional - Discount)
  amountPaid: number; // Payments recorded on this visit
  previousCarriedDue: number; // Unpaid balance carried forward from previous visits
  cumulativePayable: number; // previousCarriedDue + totalCost
  balanceAfterVisit: number; // Math.max(0, cumulativePayable - amountPaid)
  outstandingDue: number; // Active collectible due (consolidated on latest visit)
  isLatestVisit: boolean;
}

// Helper to recalculate all visits for a patient chronologically so carried-forward partial payment dues + new visit charges are 100% accurate
// High-performance batch implementation: fetches all visits, treatment sums, test sums, and payments in parallel,
// calculates cumulative balances in-memory, and only writes to the DB if visit figures changed.
export async function recalculatePatientFinancials(patientId: number): Promise<Map<number, VisitFinancialSnapshot>> {
  const [patientVisits, treatmentRows, testRows, paymentRows] = await Promise.all([
    db
      .select()
      .from(visits)
      .where(eq(visits.patientId, patientId))
      .orderBy(asc(visits.visitDate), asc(visits.id)),
    db
      .select({
        visitId: treatments.visitId,
        total: sql<string>`COALESCE(SUM(${treatments.cost}), 0)`,
      })
      .from(treatments)
      .where(eq(treatments.patientId, patientId))
      .groupBy(treatments.visitId),
    db
      .select({
        visitId: diagnosticTests.visitId,
        total: sql<string>`COALESCE(SUM(${diagnosticTests.cost}), 0)`,
      })
      .from(diagnosticTests)
      .where(eq(diagnosticTests.patientId, patientId))
      .groupBy(diagnosticTests.visitId),
    db
      .select({
        visitId: payments.visitId,
        total: sql<string>`COALESCE(SUM(${payments.amount}), 0)`,
      })
      .from(payments)
      .where(eq(payments.patientId, patientId))
      .groupBy(payments.visitId),
  ]);

  const snapshotMap = new Map<number, VisitFinancialSnapshot>();
  if (patientVisits.length === 0) return snapshotMap;

  const treatmentMap = new Map<number, number>();
  for (const r of treatmentRows) {
    treatmentMap.set(r.visitId, Number(parseFloat(r.total || '0').toFixed(2)));
  }

  const testMap = new Map<number, number>();
  for (const r of testRows) {
    testMap.set(r.visitId, Number(parseFloat(r.total || '0').toFixed(2)));
  }

  const paymentMap = new Map<number, number>();
  for (const r of paymentRows) {
    paymentMap.set(r.visitId, Number(parseFloat(r.total || '0').toFixed(2)));
  }

  let runningBalanceDue = 0;
  const updatesToRun: Promise<any>[] = [];

  for (let idx = 0; idx < patientVisits.length; idx++) {
    const v = patientVisits[idx];
    const isLatestVisit = idx === patientVisits.length - 1;

    const treatmentCost = treatmentMap.get(v.id) || 0;
    const testCost = testMap.get(v.id) || 0;
    const additionalCharges = Number(parseFloat(v.additionalCharges || '0').toFixed(2));
    const discount = Number(parseFloat(v.discount || '0').toFixed(2));

    // Net Visit Bill = Treatments + Tests + Additional Charges - Discount
    const totalCost = Math.max(0, Number((treatmentCost + testCost + additionalCharges - discount).toFixed(2)));
    const amountPaid = paymentMap.get(v.id) || 0;

    // Cumulative Running Formula:
    // Previous Carried-Forward Due + This Visit Net Cost - This Visit Payments = Balance After Visit
    const previousCarriedDue = runningBalanceDue;
    const cumulativePayable = Number((previousCarriedDue + totalCost).toFixed(2));
    const balanceAfterVisit = Math.max(0, Number((cumulativePayable - amountPaid).toFixed(2)));
    runningBalanceDue = balanceAfterVisit;

    // Only the latest visit holds the active collectible due (since earlier unpaid balances are carried forward)
    const outstandingDue = isLatestVisit ? balanceAfterVisit : 0;

    const treatmentCostStr = treatmentCost.toFixed(2);
    const testCostStr = testCost.toFixed(2);
    const totalCostStr = totalCost.toFixed(2);
    const amountPaidStr = amountPaid.toFixed(2);
    const outstandingDueStr = outstandingDue.toFixed(2);

    // Only update DB if fields actually changed to eliminate redundant network write cycles
    const needsUpdate =
      v.totalTreatmentCost !== treatmentCostStr ||
      v.totalTestCost !== testCostStr ||
      v.totalCost !== totalCostStr ||
      v.amountPaid !== amountPaidStr ||
      v.outstandingDue !== outstandingDueStr;

    if (needsUpdate) {
      updatesToRun.push(
        db
          .update(visits)
          .set({
            totalTreatmentCost: treatmentCostStr,
            totalTestCost: testCostStr,
            totalCost: totalCostStr,
            amountPaid: amountPaidStr,
            outstandingDue: outstandingDueStr,
            updatedAt: new Date(),
          })
          .where(eq(visits.id, v.id))
      );
    }

    snapshotMap.set(v.id, {
      visitId: v.id,
      visitCode: v.visitId,
      treatmentCost,
      testCost,
      additionalCharges,
      discount,
      totalCost,
      amountPaid,
      previousCarriedDue,
      cumulativePayable,
      balanceAfterVisit,
      outstandingDue,
      isLatestVisit,
    });
  }

  if (updatesToRun.length > 0) {
    await Promise.all(updatesToRun);
  }

  return snapshotMap;
}

// Helper to recalculate visit financials (and synchronize the patient's entire visit chain)
export async function recalculateVisitFinancials(visitId: number) {
  const [currentVisit] = await db
    .select({ id: visits.id, patientId: visits.patientId })
    .from(visits)
    .where(eq(visits.id, visitId));

  if (!currentVisit) return null;

  const snapshotMap = await recalculatePatientFinancials(currentVisit.patientId);
  return snapshotMap.get(visitId) || null;
}


// ==========================================
// 1. AUTHENTICATION ROUTES
// ==========================================

apiRouter.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username.trim().toLowerCase()));

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    if (!user.isActive) {
      return res.status(403).json({ error: 'Account has been deactivated. Please contact administrator.' });
    }

    if (!user.passwordHash) {
      return res.status(401).json({ error: 'Account has no password set. Please use Google Sign-In or contact administrator.' });
    }

    const passwordMatch = bcrypt.compareSync(password, user.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    const token = generateToken({
      id: user.id,
      uid: user.uid,
      username: user.username,
      fullName: user.fullName,
      role: user.role as any,
      email: user.email,
      isActive: user.isActive,
      specialization: user.specialization,
    });

    await logAudit(
      {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role as any,
        isActive: user.isActive,
      },
      'LOGIN_SUCCESS',
      `User ${user.username}`,
      'Successful username/password login'
    );

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        email: user.email,
        phone: user.phone,
        specialization: user.specialization,
        qualifications: user.qualifications,
      },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed due to server error.' });
  }
});

apiRouter.get('/auth/demo-accounts', async (req, res) => {
  try {
    const doctorList = await db
      .select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        role: users.role,
        specialization: users.specialization,
      })
      .from(users)
      .where(eq(users.isActive, true))
      .orderBy(asc(users.id));

    res.json(doctorList);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to retrieve accounts' });
  }
});

apiRouter.get('/auth/me', authenticateToken, async (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user });
});

apiRouter.post('/auth/change-password', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Both current and new password are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters.' });
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user!.id));

    if (!user || !user.passwordHash) {
      return res.status(400).json({ error: 'Cannot update password for this account.' });
    }

    if (!bcrypt.compareSync(currentPassword, user.passwordHash)) {
      return res.status(400).json({ error: 'Current password does not match.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const newHash = bcrypt.hashSync(newPassword, salt);

    await db.update(users).set({ passwordHash: newHash }).where(eq(users.id, user.id));

    await logAudit(req.user, 'CHANGE_PASSWORD', `User ${user.username}`, 'User changed their own password');

    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to change password.' });
  }
});

// ==========================================
// 2. DOCTOR & USER MANAGEMENT
// ==========================================

apiRouter.get('/doctors', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const doctors = await db
      .select({
        id: users.id,
        username: users.username,
        fullName: users.fullName,
        email: users.email,
        phone: users.phone,
        role: users.role,
        isActive: users.isActive,
        specialization: users.specialization,
        qualifications: users.qualifications,
        joiningDate: users.joiningDate,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(asc(users.id));

    // Calculate statistics for each doctor
    const doctorsWithStats = await Promise.all(
      doctors.map(async (doc) => {
        const [visitCount] = await db
          .select({ count: count() })
          .from(visits)
          .where(eq(visits.doctorId, doc.id));

        const uniquePatients = await db
          .select({ patientId: visits.patientId })
          .from(visits)
          .where(eq(visits.doctorId, doc.id))
          .groupBy(visits.patientId);

        const todayStr = new Date().toISOString().split('T')[0];
        const [todayVisits] = await db
          .select({ count: count() })
          .from(visits)
          .where(and(eq(visits.doctorId, doc.id), eq(visits.visitDate, todayStr)));

        return {
          ...doc,
          totalVisits: Number(visitCount?.count || 0),
          uniquePatients: uniquePatients.length,
          todayVisits: Number(todayVisits?.count || 0),
        };
      })
    );

    res.json(doctorsWithStats);
  } catch (error: any) {
    console.error('Error fetching doctors:', error);
    res.status(500).json({ error: 'Failed to load doctors' });
  }
});

apiRouter.post(
  '/doctors',
  authenticateToken,
  requireRoles('main_doctor', 'developer'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const {
        username,
        password,
        fullName,
        email,
        phone,
        specialization,
        qualifications,
        role = 'doctor',
      } = req.body;

      if (!username || !password || !fullName) {
        return res.status(400).json({ error: 'Username, password, and full name are required.' });
      }

      // Check if username taken
      const [existing] = await db
        .select()
        .from(users)
        .where(eq(users.username, username.trim().toLowerCase()));

      if (existing) {
        return res.status(400).json({ error: 'Username already in use.' });
      }

      const salt = bcrypt.genSaltSync(10);
      const passwordHash = bcrypt.hashSync(password, salt);

      const [newDoctor] = await db
        .insert(users)
        .values({
          username: username.trim().toLowerCase(),
          passwordHash,
          fullName: fullName.trim(),
          email: email?.trim() || null,
          phone: phone?.trim() || null,
          role,
          isActive: true,
          specialization: specialization?.trim() || null,
          qualifications: qualifications?.trim() || null,
          joiningDate: new Date().toISOString().split('T')[0],
        })
        .returning();

      await logAudit(
        req.user,
        'CREATE_DOCTOR',
        `Doctor ${newDoctor.fullName} (${newDoctor.username})`,
        `Role: ${role}, Specialization: ${specialization}`
      );

      res.status(201).json(newDoctor);
    } catch (error: any) {
      console.error('Create doctor error:', error);
      res.status(500).json({ error: 'Failed to create doctor account.' });
    }
  }
);

apiRouter.put(
  '/doctors/:id',
  authenticateToken,
  async (req: AuthenticatedRequest, res) => {
    try {
      const docId = parseInt(req.params.id);
      // Only main_doctor, developer, or self can edit
      if (req.user!.role === 'doctor' && req.user!.id !== docId) {
        return res.status(403).json({ error: 'You can only edit your own profile.' });
      }

      const { fullName, email, phone, specialization, qualifications, isActive } = req.body;

      const updateData: any = {};
      if (fullName !== undefined) updateData.fullName = fullName;
      if (email !== undefined) updateData.email = email;
      if (phone !== undefined) updateData.phone = phone;
      if (specialization !== undefined) updateData.specialization = specialization;
      if (qualifications !== undefined) updateData.qualifications = qualifications;
      if (isActive !== undefined && (req.user!.role === 'main_doctor' || req.user!.role === 'developer')) {
        updateData.isActive = isActive;
      }

      const [updated] = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, docId))
        .returning();

      await logAudit(
        req.user,
        'UPDATE_DOCTOR',
        `User ID ${docId}`,
        JSON.stringify(updateData)
      );

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to update doctor' });
    }
  }
);

apiRouter.put(
  '/doctors/:id/toggle-status',
  authenticateToken,
  requireRoles('main_doctor', 'developer'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const docId = parseInt(req.params.id);
      const [target] = await db.select().from(users).where(eq(users.id, docId));
      if (!target) return res.status(404).json({ error: 'Doctor not found' });

      // Prevent deactivating own account
      if (target.id === req.user!.id) {
        return res.status(400).json({ error: 'You cannot deactivate your own account.' });
      }

      const newStatus = !target.isActive;
      const [updated] = await db
        .update(users)
        .set({ isActive: newStatus })
        .where(eq(users.id, docId))
        .returning();

      await logAudit(
        req.user,
        'TOGGLE_DOCTOR_STATUS',
        `Doctor ${target.fullName}`,
        `Status changed to ${newStatus ? 'ACTIVE' : 'DEACTIVATED'}`
      );

      res.json(updated);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to toggle doctor status' });
    }
  }
);

apiRouter.put(
  '/doctors/:id/reset-password',
  authenticateToken,
  requireRoles('main_doctor', 'developer'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const docId = parseInt(req.params.id);
      const { newPassword } = req.body;
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters.' });
      }

      const salt = bcrypt.genSaltSync(10);
      const passwordHash = bcrypt.hashSync(newPassword, salt);

      await db.update(users).set({ passwordHash }).where(eq(users.id, docId));

      await logAudit(
        req.user,
        'ADMIN_RESET_PASSWORD',
        `User ID ${docId}`,
        'Password reset by administrator'
      );

      res.json({ success: true, message: 'Password reset successfully.' });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to reset password.' });
    }
  }
);

// ==========================================
// 3. PATIENT MANAGEMENT & SHARED REPOSITORY
// ==========================================

// Check duplicate before registering
apiRouter.get('/patients/check-duplicate', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { phone, name } = req.query;
    if (!phone && !name) {
      return res.json({ duplicates: [] });
    }

    const conditions = [];
    if (phone && typeof phone === 'string') {
      conditions.push(like(patients.phone, `%${phone.trim()}%`));
      conditions.push(like(patients.altPhone, `%${phone.trim()}%`));
    }
    if (name && typeof name === 'string' && name.trim().length > 2) {
      conditions.push(like(sql`LOWER(${patients.name})`, `%${name.trim().toLowerCase()}%`));
    }

    const matches = await db
      .select({
        id: patients.id,
        patientId: patients.patientId,
        name: patients.name,
        phone: patients.phone,
        age: patients.age,
        gender: patients.gender,
        registrationDate: patients.registrationDate,
      })
      .from(patients)
      .where(or(...conditions))
      .limit(5);

    res.json({ duplicates: matches });
  } catch (error: any) {
    res.status(500).json({ error: 'Duplicate check failed' });
  }
});

// Centralized patient search & list
apiRouter.get('/patients', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { search, gender, hasDue, dueStatus, fromDate, toDate, doctorId } = req.query;

    const baseQuery = db
      .select({
        id: patients.id,
        patientId: patients.patientId,
        name: patients.name,
        phone: patients.phone,
        altPhone: patients.altPhone,
        age: patients.age,
        gender: patients.gender,
        address: patients.address,
        registrationDate: patients.registrationDate,
        existingDiseases: patients.existingDiseases,
        allergies: patients.allergies,
        createdBy: patients.createdBy,
        createdAt: patients.createdAt,
      })
      .from(patients);

    const conditions = [];

    if (search && typeof search === 'string') {
      const q = `%${search.trim().toLowerCase()}%`;
      conditions.push(
        or(
          like(sql`LOWER(${patients.name})`, q),
          like(sql`LOWER(${patients.patientId})`, q),
          like(patients.phone, `%${search.trim()}%`),
          like(patients.altPhone, `%${search.trim()}%`)
        )
      );
    }

    if (gender && typeof gender === 'string' && gender !== 'All') {
      conditions.push(eq(patients.gender, gender));
    }

    if (fromDate && typeof fromDate === 'string' && fromDate.trim()) {
      conditions.push(sql`${patients.registrationDate} >= ${fromDate.trim()}`);
    }

    if (toDate && typeof toDate === 'string' && toDate.trim()) {
      conditions.push(sql`${patients.registrationDate} <= ${toDate.trim()}`);
    }

    const patientList = conditions.length > 0
      ? await baseQuery.where(and(...conditions)).orderBy(desc(patients.id))
      : await baseQuery.orderBy(desc(patients.id));

    const targetDoctorId = doctorId && doctorId !== 'All' ? parseInt(doctorId as string) : null;

    if (patientList.length === 0) {
      return res.json([]);
    }

    const patientIds = patientList.map((p) => p.id);

    // High-performance batch queries: fetch all visits and upcoming follow-ups for all filtered patients in 2 queries
    const [allVisits, allUpcomingAppointments] = await Promise.all([
      db
        .select({
          id: visits.id,
          patientId: visits.patientId,
          doctorId: visits.doctorId,
          doctorName: users.fullName,
          visitDate: visits.visitDate,
          totalCost: visits.totalCost,
          amountPaid: visits.amountPaid,
          outstandingDue: visits.outstandingDue,
        })
        .from(visits)
        .innerJoin(users, eq(visits.doctorId, users.id))
        .where(inArray(visits.patientId, patientIds))
        .orderBy(desc(visits.visitDate)),
      db
        .select({
          patientId: appointments.patientId,
          followUpDate: appointments.followUpDate,
        })
        .from(appointments)
        .where(
          and(
            inArray(appointments.patientId, patientIds),
            eq(appointments.status, 'Scheduled'),
            sql`${appointments.followUpDate} >= ${new Date().toISOString().split('T')[0]}`
          )
        )
        .orderBy(asc(appointments.followUpDate)),
    ]);

    // Group visits by patientId in-memory
    const visitsByPatient = new Map<number, typeof allVisits>();
    for (const v of allVisits) {
      const arr = visitsByPatient.get(v.patientId) || [];
      arr.push(v);
      visitsByPatient.set(v.patientId, arr);
    }

    // Map earliest upcoming follow-up per patient
    const nextFollowUpByPatient = new Map<number, string>();
    for (const a of allUpcomingAppointments) {
      if (!nextFollowUpByPatient.has(a.patientId)) {
        nextFollowUpByPatient.set(a.patientId, a.followUpDate);
      }
    }

    // Calculate aggregated stats for each patient in-memory in microseconds
    const patientsWithFinancials = patientList.map((p) => {
      const pVisits = visitsByPatient.get(p.id) || [];
      const visitCount = pVisits.length;
      const attendedDoctorIds = Array.from(new Set(pVisits.map((v) => v.doctorId)));
      const attendedDoctorNames = Array.from(new Set(pVisits.map((v) => v.doctorName)));
      const uniqueDoctorsCount = attendedDoctorIds.length;
      const myVisitCount = targetDoctorId
        ? pVisits.filter((v) => v.doctorId === targetDoctorId).length
        : pVisits.filter((v) => v.doctorId === req.user?.id).length;
      const lastVisitDate = pVisits[0]?.visitDate || null;

      let totalCost = 0;
      let totalPaid = 0;
      let totalDue = 0;

      for (const v of pVisits) {
        totalCost += parseFloat(v.totalCost || '0');
        totalPaid += parseFloat(v.amountPaid || '0');
        totalDue += parseFloat(v.outstandingDue || '0');
      }

      return {
        ...p,
        visitCount,
        myVisitCount,
        uniqueDoctorsCount,
        attendedDoctorIds,
        attendedDoctorNames,
        lastVisitDate,
        nextFollowUpDate: nextFollowUpByPatient.get(p.id) || null,
        totalExpenses: totalCost,
        totalPaid,
        totalDue,
      };
    });

    // Filter by doctorId, hasDue, or dueStatus if requested
    let filteredResults = patientsWithFinancials;
    if (targetDoctorId && !isNaN(targetDoctorId)) {
      filteredResults = filteredResults.filter(
        (p) => p.attendedDoctorIds.includes(targetDoctorId) || p.createdBy === targetDoctorId
      );
    }
    if (hasDue === 'true' || dueStatus === 'due') {
      filteredResults = filteredResults.filter((p) => p.totalDue > 0.01);
    } else if (dueStatus === 'paid') {
      filteredResults = filteredResults.filter((p) => p.totalDue <= 0.01 && (p.totalExpenses || 0) > 0);
    }

    res.json(filteredResults);
  } catch (error: any) {
    console.error('Error fetching patients:', error);
    res.status(500).json({ error: 'Failed to fetch patients' });
  }
});

// Register new patient
apiRouter.post('/patients', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      name,
      phone,
      altPhone,
      age,
      gender,
      address,
      medicalHistory,
      allergies,
      existingDiseases,
      notes,
      registrationDate,
    } = req.body;

    if (!name || !phone || !gender) {
      return res.status(400).json({ error: 'Patient Name, Phone, and Gender are required.' });
    }

    // Auto-generate next Patient ID (DP-XXXX)
    const [latestPatient] = await db
      .select({ id: patients.id })
      .from(patients)
      .orderBy(desc(patients.id))
      .limit(1);

    const nextNumber = 1000 + (latestPatient?.id || 0) + 1;
    const generatedPatientId = `DP-${nextNumber}`;

    const regDate = registrationDate || new Date().toISOString().split('T')[0];

    const [newPatient] = await db
      .insert(patients)
      .values({
        patientId: generatedPatientId,
        name: name.trim(),
        phone: phone.trim(),
        altPhone: altPhone?.trim() || null,
        age: age ? parseInt(age) : null,
        gender,
        address: address?.trim() || null,
        registrationDate: regDate,
        medicalHistory: medicalHistory?.trim() || null,
        allergies: allergies?.trim() || null,
        existingDiseases: existingDiseases?.trim() || null,
        notes: notes?.trim() || null,
        createdBy: req.user!.id,
      })
      .returning();

    await logAudit(
      req.user,
      'CREATE_PATIENT',
      `Patient ${newPatient.patientId} (${newPatient.name})`,
      `Registered by ${req.user!.fullName} (${req.user!.role})`
    );

    res.status(201).json(newPatient);
  } catch (error: any) {
    console.error('Error registering patient:', error);
    res.status(500).json({ error: 'Failed to register patient' });
  }
});

// Single patient detailed profile (Centralized history across all doctors)
apiRouter.get('/patients/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const patientId = parseInt(req.params.id);

    const [patient] = await db
      .select()
      .from(patients)
      .where(eq(patients.id, patientId));

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Reconcile patient's chronological visit chain so carried-forward partial payment dues + new visit charges are 100% accurate
    const visitSnapshotMap = await recalculatePatientFinancials(patientId);

    // Fetch all visits in chronological order (newest first)
    const visitRecords = await db
      .select({
        id: visits.id,
        visitId: visits.visitId,
        patientId: visits.patientId,
        doctorId: visits.doctorId,
        doctorName: users.fullName,
        doctorSpecialization: users.specialization,
        visitDate: visits.visitDate,
        visitTime: visits.visitTime,
        complaints: visits.complaints,
        diagnosis: visits.diagnosis,
        notes: visits.notes,
        nextFollowUpDate: visits.nextFollowUpDate,
        totalTreatmentCost: visits.totalTreatmentCost,
        totalTestCost: visits.totalTestCost,
        additionalCharges: visits.additionalCharges,
        discount: visits.discount,
        totalCost: visits.totalCost,
        amountPaid: visits.amountPaid,
        outstandingDue: visits.outstandingDue,
        status: visits.status,
        createdAt: visits.createdAt,
      })
      .from(visits)
      .innerJoin(users, eq(visits.doctorId, users.id))
      .where(eq(visits.patientId, patientId))
      .orderBy(desc(visits.visitDate), desc(visits.id));

    // Fetch treatments for all visits
    const treatmentRecords = await db
      .select({
        id: treatments.id,
        visitId: treatments.visitId,
        doctorId: treatments.doctorId,
        doctorName: users.fullName,
        treatmentName: treatments.treatmentName,
        description: treatments.description,
        toothNumber: treatments.toothNumber,
        cost: treatments.cost,
        status: treatments.status,
        notes: treatments.notes,
        treatmentDate: treatments.treatmentDate,
      })
      .from(treatments)
      .innerJoin(users, eq(treatments.doctorId, users.id))
      .where(eq(treatments.patientId, patientId))
      .orderBy(desc(treatments.treatmentDate), desc(treatments.id));

    // Fetch diagnostic tests & X-rays for all visits
    const testRecords = await db
      .select({
        id: diagnosticTests.id,
        visitId: diagnosticTests.visitId,
        doctorId: diagnosticTests.doctorId,
        doctorName: users.fullName,
        testName: diagnosticTests.testName,
        category: diagnosticTests.category,
        description: diagnosticTests.description,
        cost: diagnosticTests.cost,
        status: diagnosticTests.status,
        notes: diagnosticTests.notes,
        testDate: diagnosticTests.testDate,
      })
      .from(diagnosticTests)
      .innerJoin(users, eq(diagnosticTests.doctorId, users.id))
      .where(eq(diagnosticTests.patientId, patientId))
      .orderBy(desc(diagnosticTests.testDate), desc(diagnosticTests.id));

    // Fetch payments for all visits
    const paymentRecords = await db
      .select({
        id: payments.id,
        paymentId: payments.paymentId,
        visitId: payments.visitId,
        visitCode: visits.visitId,
        amount: payments.amount,
        paymentMethod: payments.paymentMethod,
        transactionRef: payments.transactionRef,
        notes: payments.notes,
        paymentDate: payments.paymentDate,
        receivedBy: payments.receivedBy,
        receiverName: users.fullName,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .leftJoin(users, eq(payments.receivedBy, users.id))
      .leftJoin(visits, eq(payments.visitId, visits.id))
      .where(eq(payments.patientId, patientId))
      .orderBy(desc(payments.paymentDate), desc(payments.id));

    // Fetch appointments/follow-ups
    const appointmentRecords = await db
      .select({
        id: appointments.id,
        visitId: appointments.visitId,
        doctorId: appointments.doctorId,
        doctorName: users.fullName,
        followUpDate: appointments.followUpDate,
        reason: appointments.reason,
        status: appointments.status,
        notes: appointments.notes,
      })
      .from(appointments)
      .innerJoin(users, eq(appointments.doctorId, users.id))
      .where(eq(appointments.patientId, patientId))
      .orderBy(desc(appointments.followUpDate));

    // Build unique doctors visited timeline
    const doctorsMap = new Map<number, { id: number; name: string; specialization: string; visitCount: number }>();
    for (const v of visitRecords) {
      if (!doctorsMap.has(v.doctorId)) {
        doctorsMap.set(v.doctorId, {
          id: v.doctorId,
          name: v.doctorName,
          specialization: v.doctorSpecialization || 'Doctor',
          visitCount: 1,
        });
      } else {
        const item = doctorsMap.get(v.doctorId)!;
        item.visitCount += 1;
      }
    }

    // Patient-wide financial totals
    let totalTreatmentExpenses = 0;
    let totalTestExpenses = 0;
    let totalAdditionalCharges = 0;
    let totalDiscounts = 0;
    let totalExpenses = 0;
    let totalAmountPaid = 0;

    for (const v of visitRecords) {
      totalTreatmentExpenses += parseFloat(v.totalTreatmentCost || '0');
      totalTestExpenses += parseFloat(v.totalTestCost || '0');
      totalAdditionalCharges += parseFloat(v.additionalCharges || '0');
      totalDiscounts += parseFloat(v.discount || '0');
      totalExpenses += parseFloat(v.totalCost || '0');
      totalAmountPaid += parseFloat(v.amountPaid || '0');
    }
    const totalOutstandingDue = Math.max(0, Number((totalExpenses - totalAmountPaid).toFixed(2)));

    // Compute exact chronological running balance for every payment of this patient across visits
    const enrichedPaymentRecords = (() => {
      const byVisitChrono = new Map<number, typeof paymentRecords>();
      const chronoAsc = [...paymentRecords].sort((a, b) => {
        if (a.paymentDate !== b.paymentDate) return a.paymentDate.localeCompare(b.paymentDate);
        return a.id - b.id;
      });
      for (const p of chronoAsc) {
        if (!byVisitChrono.has(p.visitId)) byVisitChrono.set(p.visitId, []);
        byVisitChrono.get(p.visitId)!.push(p);
      }

      const metaMap = new Map<
        number,
        {
          installmentNumber: number;
          totalInstallments: number;
          patientInstallmentNumber: number;
          patientTotalInstallments: number;
          cumulativePaidAfter: number;
          remainingDueAfter: number;
          previousDueBefore: number;
          previousCarriedDue: number;
          visitTotalCost: string;
          visitDiscount: string;
          visitAmountPaid: string;
          visitOutstandingDue: string;
        }
      >();

      const patientInstIndexMap = new Map<number, number>();
      chronoAsc.forEach((p, idx) => {
        patientInstIndexMap.set(p.id, idx + 1);
      });

      for (const [vId, list] of byVisitChrono.entries()) {
        const snap = visitSnapshotMap.get(vId);
        // Starting payable balance for this visit = Previous Carried-Forward Due + This Visit Net Cost
        const startingPayableForVisit = snap ? snap.cumulativePayable : parseFloat('0');
        const prevCarried = snap ? snap.previousCarriedDue : 0;
        let runningPaidOnVisit = 0;

        list.forEach((item, idx) => {
          const amt = parseFloat(item.amount || '0');
          const prevDue = Math.max(0, Number((startingPayableForVisit - runningPaidOnVisit).toFixed(2)));
          runningPaidOnVisit = Number((runningPaidOnVisit + amt).toFixed(2));
          const remDue = Math.max(0, Number((startingPayableForVisit - runningPaidOnVisit).toFixed(2)));

          metaMap.set(item.id, {
            installmentNumber: idx + 1,
            totalInstallments: list.length,
            patientInstallmentNumber: patientInstIndexMap.get(item.id) || idx + 1,
            patientTotalInstallments: chronoAsc.length,
            cumulativePaidAfter: runningPaidOnVisit,
            remainingDueAfter: remDue,
            previousDueBefore: prevDue,
            previousCarriedDue: prevCarried,
            visitTotalCost: snap ? snap.totalCost.toFixed(2) : '0.00',
            visitDiscount: snap ? snap.discount.toFixed(2) : '0.00',
            visitAmountPaid: snap ? snap.amountPaid.toFixed(2) : '0.00',
            visitOutstandingDue: snap ? snap.outstandingDue.toFixed(2) : '0.00',
          });
        });
      }

      return paymentRecords.map((p) => ({
        ...p,
        ...(metaMap.get(p.id) || {
          installmentNumber: 1,
          totalInstallments: 1,
          patientInstallmentNumber: 1,
          patientTotalInstallments: 1,
          cumulativePaidAfter: parseFloat(p.amount || '0'),
          remainingDueAfter: 0,
          previousDueBefore: parseFloat(p.amount || '0'),
          previousCarriedDue: 0,
        }),
      }));
    })();

    const visitsWithDetails = visitRecords.map((v, vIdx) => {
      const snap = visitSnapshotMap.get(v.id);
      const isLatestVisit = snap ? snap.isLatestVisit : vIdx === 0;
      return {
        ...v,
        previousCarriedDue: snap?.previousCarriedDue ?? 0,
        cumulativePayable: snap?.cumulativePayable ?? parseFloat(v.totalCost || '0'),
        balanceAfterVisit: snap?.balanceAfterVisit ?? parseFloat(v.outstandingDue || '0'),
        outstandingDue: isLatestVisit
          ? (snap?.outstandingDue ?? parseFloat(v.outstandingDue || '0')).toFixed(2)
          : '0.00',
        isLatestVisit,
        visitSequenceNumber: visitRecords.length - vIdx,
        patientTotalVisits: visitRecords.length,
        treatments: treatmentRecords.filter((t) => t.visitId === v.id),
        diagnosticTests: testRecords.filter((t) => t.visitId === v.id),
        payments: enrichedPaymentRecords.filter((p) => p.visitId === v.id),
      };
    });

    res.json({
      ...patient,
      financialSummary: {
        totalTreatmentExpenses,
        totalTestExpenses,
        totalAdditionalCharges,
        totalDiscounts,
        totalExpenses,
        totalAmountPaid,
        totalOutstandingDue,
      },
      stats: {
        totalVisits: visitRecords.length,
        totalDoctorsVisited: doctorsMap.size,
        lastVisitDate: visitRecords[0]?.visitDate || null,
        nextFollowUpDate: appointmentRecords.find((a) => a.status === 'Scheduled')?.followUpDate || null,
      },
      doctorHistory: Array.from(doctorsMap.values()),
      visits: visitsWithDetails,
      treatments: treatmentRecords,
      diagnosticTests: testRecords,
      payments: enrichedPaymentRecords,
      appointments: appointmentRecords,
    });
  } catch (error: any) {
    console.error('Error fetching patient profile:', error);
    res.status(500).json({ error: 'Failed to load patient profile' });
  }
});

// Update patient
apiRouter.put('/patients/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const patientId = parseInt(req.params.id);
    const {
      name,
      phone,
      altPhone,
      age,
      gender,
      address,
      medicalHistory,
      allergies,
      existingDiseases,
      notes,
    } = req.body;

    const [updated] = await db
      .update(patients)
      .set({
        name: name?.trim(),
        phone: phone?.trim(),
        altPhone: altPhone?.trim() || null,
        age: age ? parseInt(age) : null,
        gender,
        address: address?.trim() || null,
        medicalHistory: medicalHistory?.trim() || null,
        allergies: allergies?.trim() || null,
        existingDiseases: existingDiseases?.trim() || null,
        notes: notes?.trim() || null,
        updatedAt: new Date(),
      })
      .where(eq(patients.id, patientId))
      .returning();

    await logAudit(
      req.user,
      'UPDATE_PATIENT',
      `Patient ${updated.patientId} (${updated.name})`,
      'Updated demographic / medical details'
    );

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update patient' });
  }
});

// Delete patient (Main Doctor & Developer only)
apiRouter.delete(
  '/patients/:id',
  authenticateToken,
  requireRoles('main_doctor', 'developer'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const patientId = parseInt(req.params.id);
      const [target] = await db.select().from(patients).where(eq(patients.id, patientId));
      if (!target) return res.status(404).json({ error: 'Patient not found' });

      // Note: Foreign keys exist; clean up or verify
      await db.delete(payments).where(eq(payments.patientId, patientId));
      await db.delete(treatments).where(eq(treatments.patientId, patientId));
      await db.delete(diagnosticTests).where(eq(diagnosticTests.patientId, patientId));
      await db.delete(appointments).where(eq(appointments.patientId, patientId));
      await db.delete(visits).where(eq(visits.patientId, patientId));
      await db.delete(patients).where(eq(patients.id, patientId));

      await logAudit(
        req.user,
        'DELETE_PATIENT',
        `Patient ${target.patientId} (${target.name})`,
        'Deleted entire patient record and associated visits/financials'
      );

      res.json({ success: true, message: 'Patient record deleted.' });
    } catch (error: any) {
      console.error('Delete patient error:', error);
      res.status(500).json({ error: 'Failed to delete patient' });
    }
  }
);

// ==========================================
// 4. VISIT MANAGEMENT MODULE
// ==========================================

apiRouter.get('/visits', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { doctorId, patientId, date, fromDate, toDate, hasDue, dueStatus, search } = req.query;

    const baseQuery = db
      .select({
        id: visits.id,
        visitId: visits.visitId,
        patientId: visits.patientId,
        patientCode: patients.patientId,
        patientName: patients.name,
        patientPhone: patients.phone,
        doctorId: visits.doctorId,
        doctorName: users.fullName,
        doctorSpecialization: users.specialization,
        visitDate: visits.visitDate,
        visitTime: visits.visitTime,
        complaints: visits.complaints,
        diagnosis: visits.diagnosis,
        notes: visits.notes,
        nextFollowUpDate: visits.nextFollowUpDate,
        totalTreatmentCost: visits.totalTreatmentCost,
        totalTestCost: visits.totalTestCost,
        additionalCharges: visits.additionalCharges,
        discount: visits.discount,
        totalCost: visits.totalCost,
        amountPaid: visits.amountPaid,
        outstandingDue: visits.outstandingDue,
        status: visits.status,
        createdAt: visits.createdAt,
      })
      .from(visits)
      .innerJoin(patients, eq(visits.patientId, patients.id))
      .innerJoin(users, eq(visits.doctorId, users.id));

    const conditions = [];

    if (doctorId) {
      conditions.push(eq(visits.doctorId, parseInt(doctorId as string)));
    }
    if (patientId) {
      conditions.push(eq(visits.patientId, parseInt(patientId as string)));
    }
    if (date) {
      conditions.push(eq(visits.visitDate, date as string));
    }
    if (fromDate && typeof fromDate === 'string' && fromDate.trim()) {
      conditions.push(sql`${visits.visitDate} >= ${fromDate.trim()}`);
    }
    if (toDate && typeof toDate === 'string' && toDate.trim()) {
      conditions.push(sql`${visits.visitDate} <= ${toDate.trim()}`);
    }
    if (hasDue === 'true' || dueStatus === 'due') {
      conditions.push(sql`${visits.outstandingDue} > 0`);
    } else if (dueStatus === 'paid') {
      conditions.push(sql`${visits.outstandingDue} <= 0`);
    }
    if (search && typeof search === 'string') {
      const q = `%${search.trim().toLowerCase()}%`;
      conditions.push(
        or(
          like(sql`LOWER(${patients.name})`, q),
          like(sql`LOWER(${patients.patientId})`, q),
          like(patients.phone, `%${search.trim()}%`),
          like(sql`LOWER(${visits.visitId})`, q),
          like(sql`LOWER(${visits.diagnosis})`, q)
        )
      );
    }

    const list = conditions.length > 0
      ? await baseQuery.where(and(...conditions)).orderBy(desc(visits.visitDate), desc(visits.id))
      : await baseQuery.orderBy(desc(visits.visitDate), desc(visits.id));

    // Compute chronological visit sequence number, cumulative balance metadata & unique doctors count per patient across all visits
    const allVisitRefs = await db
      .select({
        id: visits.id,
        patientId: visits.patientId,
        doctorId: visits.doctorId,
        visitDate: visits.visitDate,
        totalCost: visits.totalCost,
        amountPaid: visits.amountPaid,
      })
      .from(visits)
      .orderBy(asc(visits.visitDate), asc(visits.id));

    const patientVisitSeqMap = new Map<number, number>();
    const patientTotalVisitsMap = new Map<number, number>();
    const patientDoctorsSetMap = new Map<number, Set<number>>();
    const patientLatestVisitIdMap = new Map<number, number>();
    const visitRunningMetaMap = new Map<
      number,
      { previousCarriedDue: number; cumulativePayable: number; balanceAfterVisit: number }
    >();
    const patientRunningDueMap = new Map<number, number>();

    for (const vr of allVisitRefs) {
      const currentCount = (patientTotalVisitsMap.get(vr.patientId) || 0) + 1;
      patientTotalVisitsMap.set(vr.patientId, currentCount);
      patientVisitSeqMap.set(vr.id, currentCount);
      patientLatestVisitIdMap.set(vr.patientId, vr.id);

      const prevDue = patientRunningDueMap.get(vr.patientId) || 0;
      const vNet = parseFloat(vr.totalCost || '0');
      const vPaid = parseFloat(vr.amountPaid || '0');
      const cumPayable = Number((prevDue + vNet).toFixed(2));
      const balAfter = Math.max(0, Number((cumPayable - vPaid).toFixed(2)));
      patientRunningDueMap.set(vr.patientId, balAfter);
      visitRunningMetaMap.set(vr.id, {
        previousCarriedDue: prevDue,
        cumulativePayable: cumPayable,
        balanceAfterVisit: balAfter,
      });

      if (!patientDoctorsSetMap.has(vr.patientId)) {
        patientDoctorsSetMap.set(vr.patientId, new Set());
      }
      patientDoctorsSetMap.get(vr.patientId)!.add(vr.doctorId);
    }

    const enrichedList = list.map((v) => {
      const isLatestVisit = patientLatestVisitIdMap.get(v.patientId) === v.id;
      const meta = visitRunningMetaMap.get(v.id);
      const effectiveDue = isLatestVisit ? (meta?.balanceAfterVisit ?? parseFloat(v.outstandingDue || '0')) : 0;
      return {
        ...v,
        outstandingDue: effectiveDue.toFixed(2),
        previousCarriedDue: meta?.previousCarriedDue ?? 0,
        cumulativePayable: meta?.cumulativePayable ?? parseFloat(v.totalCost || '0'),
        balanceAfterVisit: meta?.balanceAfterVisit ?? parseFloat(v.outstandingDue || '0'),
        isLatestVisit,
        visitSequenceNumber: patientVisitSeqMap.get(v.id) || 1,
        patientTotalVisits: patientTotalVisitsMap.get(v.patientId) || 1,
        patientUniqueDoctorsCount: patientDoctorsSetMap.get(v.patientId)?.size || 1,
      };
    });

    // If caller requested only visits with active due, filter to latest visits with effectiveDue > 0
    const finalVisits =
      hasDue === 'true' || dueStatus === 'due'
        ? enrichedList.filter((v) => v.isLatestVisit && parseFloat(v.outstandingDue) > 0.01)
        : dueStatus === 'paid'
        ? enrichedList.filter((v) => parseFloat(v.outstandingDue) <= 0.01)
        : enrichedList;

    res.json(finalVisits);
  } catch (error: any) {
    console.error('Error fetching visits:', error);
    res.status(500).json({ error: 'Failed to fetch visits' });
  }
});

// Create new visit under an existing patient
// Can be created by ANY doctor for ANY patient!
apiRouter.post('/visits', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const {
      patientId,
      doctorId, // Optional: defaults to logged-in doctor, or authorized user can specify
      visitDate,
      visitTime,
      complaints,
      diagnosis,
      notes,
      nextFollowUpDate,
      additionalCharges = 0,
      discount = 0,
      initialTreatments = [], // Array of { treatmentName, description, toothNumber, cost }
      initialTests = [], // Array of { testName, category, description, cost }
      initialPayment = null, // { amount, paymentMethod, transactionRef, notes }
    } = req.body;

    if (!patientId) {
      return res.status(400).json({ error: 'Patient ID is required.' });
    }

    // Verify patient exists
    const [patient] = await db
      .select()
      .from(patients)
      .where(eq(patients.id, parseInt(patientId)));

    if (!patient) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    // Determine attending doctor:
    let attendingDoctorId = req.user!.id;
    if (doctorId) {
      const parsedDoc = parseInt(doctorId);
      if (!isNaN(parsedDoc) && parsedDoc > 0) {
        attendingDoctorId = parsedDoc;
      }
    }

    // Generate next Visit ID (VST-XXXX)
    const [latestVisit] = await db
      .select({ id: visits.id })
      .from(visits)
      .orderBy(desc(visits.id))
      .limit(1);

    const nextVisitNumber = 1000 + (latestVisit?.id || 0) + 1;
    const generatedVisitId = `VST-${nextVisitNumber}`;

    const vDate = visitDate || new Date().toISOString().split('T')[0];
    const vTime = visitTime || new Date().toTimeString().slice(0, 5);

    // Initial calculations
    let treatmentCostTotal = 0;
    for (const t of initialTreatments) {
      treatmentCostTotal += parseFloat(t.cost || 0);
    }

    let testCostTotal = 0;
    for (const t of initialTests) {
      testCostTotal += parseFloat(t.cost || 0);
    }

    const addCharges = parseFloat(additionalCharges || 0);
    const disc = parseFloat(discount || 0);
    const totalCost = Math.max(0, treatmentCostTotal + testCostTotal + addCharges - disc);

    // Check previous carried-forward due for this patient
    const priorSnapshots = await recalculatePatientFinancials(patient.id);
    let priorCarriedDue = 0;
    for (const snap of priorSnapshots.values()) {
      if (snap.isLatestVisit) {
        priorCarriedDue = snap.balanceAfterVisit;
      }
    }

    const initPayAmount = initialPayment?.amount ? parseFloat(initialPayment.amount) : 0;
    const cumulativePayable = Number((priorCarriedDue + totalCost).toFixed(2));
    const outstandingDue = Math.max(0, Number((cumulativePayable - initPayAmount).toFixed(2)));

    // Insert visit
    const [newVisit] = await db
      .insert(visits)
      .values({
        visitId: generatedVisitId,
        patientId: patient.id,
        doctorId: attendingDoctorId,
        visitDate: vDate,
        visitTime: vTime,
        complaints: complaints?.trim() || null,
        diagnosis: diagnosis?.trim() || null,
        notes: notes?.trim() || null,
        nextFollowUpDate: nextFollowUpDate || null,
        totalTreatmentCost: treatmentCostTotal.toFixed(2),
        totalTestCost: testCostTotal.toFixed(2),
        additionalCharges: addCharges.toFixed(2),
        discount: disc.toFixed(2),
        totalCost: totalCost.toFixed(2),
        amountPaid: initPayAmount.toFixed(2),
        outstandingDue: outstandingDue.toFixed(2),
        status: 'Completed',
      })
      .returning();

    // Insert treatments if any
    for (const t of initialTreatments) {
      if (t.treatmentName) {
        await db.insert(treatments).values({
          visitId: newVisit.id,
          patientId: patient.id,
          doctorId: attendingDoctorId,
          treatmentName: t.treatmentName.trim(),
          description: t.description?.trim() || null,
          toothNumber: t.toothNumber?.trim() || null,
          cost: parseFloat(t.cost || 0).toFixed(2),
          status: 'Completed',
          notes: t.notes?.trim() || null,
          treatmentDate: vDate,
        });
      }
    }

    // Insert tests if any
    for (const t of initialTests) {
      if (t.testName) {
        await db.insert(diagnosticTests).values({
          visitId: newVisit.id,
          patientId: patient.id,
          doctorId: attendingDoctorId,
          testName: t.testName.trim(),
          category: t.category || 'Dental X-ray',
          description: t.description?.trim() || null,
          cost: parseFloat(t.cost || 0).toFixed(2),
          status: 'Completed',
          notes: t.notes?.trim() || null,
          testDate: vDate,
        });
      }
    }

    // Insert initial payment if any
    if (initPayAmount > 0) {
      const [latestPay] = await db
        .select({ id: payments.id })
        .from(payments)
        .orderBy(desc(payments.id))
        .limit(1);
      const nextPayId = `PAY-${1000 + (latestPay?.id || 0) + 1}`;

      let collectorDoctorId = attendingDoctorId;
      if (initialPayment.receivedBy) {
        const parsed = parseInt(initialPayment.receivedBy);
        if (!isNaN(parsed) && parsed > 0) {
          collectorDoctorId = parsed;
        }
      }

      await db.insert(payments).values({
        paymentId: nextPayId,
        patientId: patient.id,
        visitId: newVisit.id,
        amount: initPayAmount.toFixed(2),
        paymentMethod: initialPayment.paymentMethod || 'Cash',
        transactionRef: initialPayment.transactionRef?.trim() || null,
        notes: initialPayment.notes?.trim() || null,
        receivedBy: collectorDoctorId,
        paymentDate: vDate,
      });
    }

    // Synchronize the patient's entire visit chain so previous carried-forward dues and new visit balance are reconciled
    await recalculatePatientFinancials(patient.id);

    // Insert follow-up appointment if scheduled
    if (nextFollowUpDate) {
      await db.insert(appointments).values({
        patientId: patient.id,
        visitId: newVisit.id,
        doctorId: attendingDoctorId,
        followUpDate: nextFollowUpDate,
        reason: diagnosis ? `Follow-up for: ${diagnosis}` : 'Routine follow-up evaluation',
        status: 'Scheduled',
      });
    }

    await logAudit(
      req.user,
      'CREATE_VISIT',
      `Visit ${newVisit.visitId} for Patient ${patient.patientId} (${patient.name})`,
      `Attending Doctor: ID ${attendingDoctorId}, Visit Cost: ৳${totalCost}, Carried Due: ৳${priorCarriedDue}, Paid: ৳${initPayAmount}, Latest Due: ৳${outstandingDue}`
    );

    res.status(201).json({
      ...newVisit,
      previousCarriedDue: priorCarriedDue,
      cumulativePayable,
      balanceAfterVisit: outstandingDue,
      outstandingDue: outstandingDue.toFixed(2),
      isLatestVisit: true,
    });
  } catch (error: any) {
    console.error('Error creating visit:', error);
    res.status(500).json({ error: 'Failed to create visit' });
  }
});

// Single visit view
apiRouter.get('/visits/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const visitId = parseInt(req.params.id);

    const [visitCheck] = await db
      .select({ patientId: visits.patientId })
      .from(visits)
      .where(eq(visits.id, visitId));

    if (!visitCheck) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    const snapshotMap = await recalculatePatientFinancials(visitCheck.patientId);
    const snap = snapshotMap.get(visitId);

    const [visit] = await db
      .select({
        id: visits.id,
        visitId: visits.visitId,
        patientId: visits.patientId,
        patientCode: patients.patientId,
        patientName: patients.name,
        patientPhone: patients.phone,
        patientAge: patients.age,
        patientGender: patients.gender,
        patientMedicalHistory: patients.medicalHistory,
        patientAllergies: patients.allergies,
        doctorId: visits.doctorId,
        doctorName: users.fullName,
        doctorSpecialization: users.specialization,
        visitDate: visits.visitDate,
        visitTime: visits.visitTime,
        complaints: visits.complaints,
        diagnosis: visits.diagnosis,
        notes: visits.notes,
        nextFollowUpDate: visits.nextFollowUpDate,
        totalTreatmentCost: visits.totalTreatmentCost,
        totalTestCost: visits.totalTestCost,
        additionalCharges: visits.additionalCharges,
        discount: visits.discount,
        totalCost: visits.totalCost,
        amountPaid: visits.amountPaid,
        outstandingDue: visits.outstandingDue,
        status: visits.status,
        createdAt: visits.createdAt,
      })
      .from(visits)
      .innerJoin(patients, eq(visits.patientId, patients.id))
      .innerJoin(users, eq(visits.doctorId, users.id))
      .where(eq(visits.id, visitId));

    if (!visit) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    // Treatments for this visit
    const visitTreatments = await db
      .select({
        id: treatments.id,
        treatmentName: treatments.treatmentName,
        description: treatments.description,
        toothNumber: treatments.toothNumber,
        cost: treatments.cost,
        status: treatments.status,
        notes: treatments.notes,
        treatmentDate: treatments.treatmentDate,
        doctorName: users.fullName,
      })
      .from(treatments)
      .innerJoin(users, eq(treatments.doctorId, users.id))
      .where(eq(treatments.visitId, visitId));

    // Tests for this visit
    const visitTests = await db
      .select({
        id: diagnosticTests.id,
        testName: diagnosticTests.testName,
        category: diagnosticTests.category,
        description: diagnosticTests.description,
        cost: diagnosticTests.cost,
        status: diagnosticTests.status,
        notes: diagnosticTests.notes,
        testDate: diagnosticTests.testDate,
        doctorName: users.fullName,
      })
      .from(diagnosticTests)
      .innerJoin(users, eq(diagnosticTests.doctorId, users.id))
      .where(eq(diagnosticTests.visitId, visitId));

    // Payments for this visit (sorted newest first, with cumulative running balance metadata)
    const visitPaymentsRaw = await db
      .select({
        id: payments.id,
        paymentId: payments.paymentId,
        visitId: payments.visitId,
        amount: payments.amount,
        paymentMethod: payments.paymentMethod,
        transactionRef: payments.transactionRef,
        notes: payments.notes,
        paymentDate: payments.paymentDate,
        receivedBy: payments.receivedBy,
        receiverName: users.fullName,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .leftJoin(users, eq(payments.receivedBy, users.id))
      .where(eq(payments.visitId, visitId))
      .orderBy(desc(payments.paymentDate), desc(payments.id));

    const startingPayable = snap ? snap.cumulativePayable : parseFloat(visit.totalCost || '0');
    const prevCarried = snap ? snap.previousCarriedDue : 0;
    const chronoAsc = [...visitPaymentsRaw].sort((a, b) => {
      if (a.paymentDate !== b.paymentDate) return a.paymentDate.localeCompare(b.paymentDate);
      return a.id - b.id;
    });
    const metaById = new Map<
      number,
      {
        installmentNumber: number;
        totalInstallments: number;
        cumulativePaidAfter: number;
        remainingDueAfter: number;
        previousDueBefore: number;
        previousCarriedDue: number;
      }
    >();
    let runningPaid = 0;
    chronoAsc.forEach((p, idx) => {
      const amt = parseFloat(p.amount || '0');
      const prevDue = Math.max(0, Number((startingPayable - runningPaid).toFixed(2)));
      runningPaid = Number((runningPaid + amt).toFixed(2));
      const remDue = Math.max(0, Number((startingPayable - runningPaid).toFixed(2)));
      metaById.set(p.id, {
        installmentNumber: idx + 1,
        totalInstallments: chronoAsc.length,
        cumulativePaidAfter: runningPaid,
        remainingDueAfter: remDue,
        previousDueBefore: prevDue,
        previousCarriedDue: prevCarried,
      });
    });

    const visitPayments = visitPaymentsRaw.map((p) => ({
      ...p,
      visitCode: visit.visitId,
      visitTotalCost: visit.totalCost,
      visitDiscount: visit.discount,
      ...(metaById.get(p.id) || {
        installmentNumber: 1,
        totalInstallments: 1,
        cumulativePaidAfter: parseFloat(p.amount || '0'),
        remainingDueAfter: 0,
        previousDueBefore: parseFloat(p.amount || '0'),
        previousCarriedDue: prevCarried,
      }),
    }));

    res.json({
      ...visit,
      previousCarriedDue: snap?.previousCarriedDue ?? 0,
      cumulativePayable: snap?.cumulativePayable ?? parseFloat(visit.totalCost || '0'),
      balanceAfterVisit: snap?.balanceAfterVisit ?? parseFloat(visit.outstandingDue || '0'),
      isLatestVisit: snap?.isLatestVisit ?? true,
      treatments: visitTreatments,
      diagnosticTests: visitTests,
      payments: visitPayments,
    });
  } catch (error: any) {
    console.error('Error fetching visit details:', error);
    res.status(500).json({ error: 'Failed to fetch visit details' });
  }
});

// Update visit (Doctor can edit own visit, Main Doctor / Dev can edit any)
apiRouter.put('/visits/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const visitId = parseInt(req.params.id);
    const [existing] = await db.select().from(visits).where(eq(visits.id, visitId));

    if (!existing) {
      return res.status(404).json({ error: 'Visit not found' });
    }

    // Role check:
    const isOwnerDoctor = req.user!.id === existing.doctorId;
    const isSuperAdmin = req.user!.role === 'main_doctor' || req.user!.role === 'developer';

    if (!isOwnerDoctor && !isSuperAdmin) {
      return res.status(403).json({
        error: 'You do not have permission to edit another doctor’s visit record. Main Doctor authorization required.',
      });
    }

    const {
      complaints,
      diagnosis,
      notes,
      nextFollowUpDate,
      additionalCharges,
      discount,
      status,
      doctorId,
    } = req.body;

    const updateData: any = { updatedAt: new Date() };
    if (complaints !== undefined) updateData.complaints = complaints?.trim();
    if (diagnosis !== undefined) updateData.diagnosis = diagnosis?.trim();
    if (notes !== undefined) updateData.notes = notes?.trim();
    if (nextFollowUpDate !== undefined) updateData.nextFollowUpDate = nextFollowUpDate;
    if (additionalCharges !== undefined) updateData.additionalCharges = parseFloat(additionalCharges).toFixed(2);
    if (discount !== undefined) updateData.discount = parseFloat(discount).toFixed(2);
    if (status !== undefined) updateData.status = status;
    if (doctorId !== undefined && isSuperAdmin) updateData.doctorId = parseInt(doctorId);

    await db.update(visits).set(updateData).where(eq(visits.id, visitId));

    // Recalculate financials
    const updatedFinancials = await recalculateVisitFinancials(visitId);

    await logAudit(
      req.user,
      'UPDATE_VISIT',
      `Visit ${existing.visitId}`,
      `Updated by ${req.user!.fullName} (${req.user!.role})`
    );

    res.json({ success: true, financials: updatedFinancials });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update visit' });
  }
});

// Apply discount / concession to visit
apiRouter.post('/visits/:id/apply-discount', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const visitId = parseInt(req.params.id);
    const [existing] = await db.select().from(visits).where(eq(visits.id, visitId));
    if (!existing) return res.status(404).json({ error: 'Visit not found' });

    const { discountAmount, reason, isTotalDiscount } = req.body;
    const discNum = parseFloat(discountAmount);

    if (isNaN(discNum) || discNum < 0) {
      return res.status(400).json({ error: 'Please enter a valid discount amount.' });
    }

    const currentDiscount = parseFloat(existing.discount || '0');
    const newDiscount = isTotalDiscount ? discNum : currentDiscount + discNum;

    // Check that total discount does not exceed charges before discount
    const treatmentCost = parseFloat(existing.totalTreatmentCost || '0');
    const testCost = parseFloat(existing.totalTestCost || '0');
    const additional = parseFloat(existing.additionalCharges || '0');
    const maxDiscount = treatmentCost + testCost + additional;

    if (newDiscount > maxDiscount + 0.01) {
      return res.status(400).json({
        error: `Discount (৳${newDiscount}) cannot exceed total charges of ৳${maxDiscount}.`,
      });
    }

    let updatedNotes = existing.notes || '';
    if (reason && reason.trim()) {
      const discountNote = `[Discount: ৳${discNum} by ${req.user!.fullName} - ${reason.trim()}]`;
      updatedNotes = updatedNotes ? `${updatedNotes} ${discountNote}` : discountNote;
    }

    await db
      .update(visits)
      .set({
        discount: newDiscount.toFixed(2),
        notes: updatedNotes,
        updatedAt: new Date(),
      })
      .where(eq(visits.id, visitId));

    const updatedFinancials = await recalculateVisitFinancials(visitId);

    await logAudit(
      req.user,
      'APPLY_DISCOUNT',
      `Visit ${existing.visitId}`,
      `Discount of ৳${discNum} applied (Total discount: ৳${newDiscount.toFixed(2)}). Reason: ${reason || 'Concession'}`
    );

    res.json({
      success: true,
      newDiscount: newDiscount.toFixed(2),
      financials: updatedFinancials,
    });
  } catch (error: any) {
    console.error('Apply discount error:', error);
    res.status(500).json({ error: 'Failed to apply discount' });
  }
});

// Delete visit (Main Doctor & Developer only)
apiRouter.delete(
  '/visits/:id',
  authenticateToken,
  requireRoles('main_doctor', 'developer'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const visitId = parseInt(req.params.id);
      const [existing] = await db.select().from(visits).where(eq(visits.id, visitId));
      if (!existing) return res.status(404).json({ error: 'Visit not found' });

      await db.delete(payments).where(eq(payments.visitId, visitId));
      await db.delete(treatments).where(eq(treatments.visitId, visitId));
      await db.delete(diagnosticTests).where(eq(diagnosticTests.visitId, visitId));
      await db.delete(appointments).where(eq(appointments.visitId, visitId));
      await db.delete(visits).where(eq(visits.id, visitId));

      await logAudit(
        req.user,
        'DELETE_VISIT',
        `Visit ${existing.visitId}`,
        `Deleted by ${req.user!.fullName}`
      );

      res.json({ success: true, message: 'Visit record deleted' });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to delete visit' });
    }
  }
);

// ==========================================
// 5. TREATMENTS MANAGEMENT
// ==========================================

apiRouter.post('/visits/:id/treatments', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const visitId = parseInt(req.params.id);
    const [visit] = await db.select().from(visits).where(eq(visits.id, visitId));
    if (!visit) return res.status(404).json({ error: 'Visit not found' });

    const { treatmentName, description, toothNumber, cost = 0, status = 'Completed', notes } = req.body;
    if (!treatmentName) {
      return res.status(400).json({ error: 'Treatment name is required.' });
    }

    const [created] = await db
      .insert(treatments)
      .values({
        visitId,
        patientId: visit.patientId,
        doctorId: req.user!.id,
        treatmentName: treatmentName.trim(),
        description: description?.trim() || null,
        toothNumber: toothNumber?.trim() || null,
        cost: parseFloat(cost).toFixed(2),
        status,
        notes: notes?.trim() || null,
        treatmentDate: visit.visitDate,
      })
      .returning();

    // Recalculate visit financials
    await recalculateVisitFinancials(visitId);

    await logAudit(
      req.user,
      'ADD_TREATMENT',
      `Treatment ${created.treatmentName} on Visit ${visit.visitId}`,
      `Cost: ৳${cost}, Tooth: ${toothNumber || 'N/A'}`
    );

    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to add treatment' });
  }
});

apiRouter.delete('/treatments/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(treatments).where(eq(treatments.id, id));
    if (!existing) return res.status(404).json({ error: 'Treatment not found' });

    // Authorization: Main Doctor, Developer, or creator doctor
    if (req.user!.role === 'doctor' && req.user!.id !== existing.doctorId) {
      return res.status(403).json({ error: 'Permission denied to delete another doctor’s treatment entry.' });
    }

    await db.delete(treatments).where(eq(treatments.id, id));
    await recalculateVisitFinancials(existing.visitId);

    await logAudit(
      req.user,
      'DELETE_TREATMENT',
      `Treatment ${existing.treatmentName} on Visit ID ${existing.visitId}`,
      `Removed cost: ৳${existing.cost}`
    );

    res.json({ success: true, message: 'Treatment removed.' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete treatment' });
  }
});

// ==========================================
// 6. DIAGNOSTIC TEST & X-RAY MANAGEMENT
// ==========================================

apiRouter.post('/visits/:id/diagnostic-tests', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const visitId = parseInt(req.params.id);
    const [visit] = await db.select().from(visits).where(eq(visits.id, visitId));
    if (!visit) return res.status(404).json({ error: 'Visit not found' });

    const { testName, category, description, cost = 0, status = 'Completed', notes } = req.body;
    if (!testName) {
      return res.status(400).json({ error: 'Test name is required.' });
    }

    const [created] = await db
      .insert(diagnosticTests)
      .values({
        visitId,
        patientId: visit.patientId,
        doctorId: req.user!.id,
        testName: testName.trim(),
        category: category || 'Dental X-ray',
        description: description?.trim() || null,
        cost: parseFloat(cost).toFixed(2),
        status,
        notes: notes?.trim() || null,
        testDate: visit.visitDate,
      })
      .returning();

    // Recalculate visit financials
    await recalculateVisitFinancials(visitId);

    await logAudit(
      req.user,
      'ADD_DIAGNOSTIC_TEST',
      `Test ${created.testName} (${created.category}) on Visit ${visit.visitId}`,
      `Cost: ৳${cost}`
    );

    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to add diagnostic test' });
  }
});

apiRouter.delete('/diagnostic-tests/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(diagnosticTests).where(eq(diagnosticTests.id, id));
    if (!existing) return res.status(404).json({ error: 'Test not found' });

    if (req.user!.role === 'doctor' && req.user!.id !== existing.doctorId) {
      return res.status(403).json({ error: 'Permission denied to delete another doctor’s test entry.' });
    }

    await db.delete(diagnosticTests).where(eq(diagnosticTests.id, id));
    await recalculateVisitFinancials(existing.visitId);

    await logAudit(
      req.user,
      'DELETE_DIAGNOSTIC_TEST',
      `Test ${existing.testName} on Visit ID ${existing.visitId}`,
      `Removed cost: ৳${existing.cost}`
    );

    res.json({ success: true, message: 'Test removed.' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete diagnostic test' });
  }
});

// ==========================================
// 7. PAYMENTS & FINANCIAL DUES
// ==========================================

apiRouter.post('/visits/:id/payments', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const requestedVisitId = parseInt(req.params.id);
    const [requestedVisit] = await db.select().from(visits).where(eq(visits.id, requestedVisitId));
    if (!requestedVisit) return res.status(404).json({ error: 'Visit not found' });

    const { amount, paymentMethod, transactionRef, notes, paymentDate, receivedBy } = req.body;
    const paymentAmount = parseFloat(amount);

    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ error: 'Payment amount must be greater than 0.' });
    }

    // Fast chronological reconciliation to always take payment according to the LATEST visit & cumulative patient balance
    const snapshotMap = await recalculatePatientFinancials(requestedVisit.patientId);
    let latestSnapshot: VisitFinancialSnapshot | null = null;
    for (const snap of snapshotMap.values()) {
      if (snap.isLatestVisit) {
        latestSnapshot = snap;
      }
    }

    const targetVisitId = latestSnapshot ? latestSnapshot.visitId : requestedVisit.id;
    const targetVisitCode = latestSnapshot ? latestSnapshot.visitCode : requestedVisit.visitId;
    const currentDue = latestSnapshot
      ? latestSnapshot.outstandingDue
      : parseFloat(requestedVisit.outstandingDue || '0');

    // Prevent accidental overpayment against the latest cumulative due
    if (paymentAmount > currentDue + 0.01) {
      return res.status(400).json({
        error: `Payment amount (৳${paymentAmount}) exceeds the latest outstanding due of ৳${currentDue}. Accidental overpayments are prevented.`,
      });
    }

    let collectorId = req.user!.id;
    if (receivedBy) {
      const parsed = parseInt(receivedBy);
      if (!isNaN(parsed) && parsed > 0) {
        collectorId = parsed;
      }
    }

    // Parallel lookup for generated ID and collector profile
    const [[latestPay], [receiverUser]] = await Promise.all([
      db
        .select({ id: payments.id })
        .from(payments)
        .orderBy(desc(payments.id))
        .limit(1),
      db
        .select({ fullName: users.fullName, specialization: users.specialization })
        .from(users)
        .where(eq(users.id, collectorId)),
    ]);

    const nextPayNumber = 1000 + (latestPay?.id || 0) + 1;
    const generatedPaymentId = `PAY-${nextPayNumber}`;
    const pDate = paymentDate || new Date().toISOString().split('T')[0];

    const [newPayment] = await db
      .insert(payments)
      .values({
        paymentId: generatedPaymentId,
        patientId: requestedVisit.patientId,
        visitId: targetVisitId,
        amount: paymentAmount.toFixed(2),
        paymentMethod: paymentMethod || 'Cash',
        transactionRef: transactionRef?.trim() || null,
        notes: notes?.trim() || null,
        receivedBy: collectorId,
        paymentDate: pDate,
      })
      .returning();

    // Recalculate once after payment insertion and fetch fresh snapshot
    const updatedSnapshotMap = await recalculatePatientFinancials(requestedVisit.patientId);
    const updatedFinancials = updatedSnapshotMap.get(targetVisitId);

    // Count total installments for this visit
    const [installmentRow] = await db
      .select({ total: sql<string>`count(*)` })
      .from(payments)
      .where(eq(payments.visitId, targetVisitId));
    const totalInstallmentsCount = parseInt(installmentRow?.total || '1', 10);

    const paymentWithReceiver = {
      ...newPayment,
      visitCode: targetVisitCode,
      receiverName: receiverUser?.fullName || req.user!.fullName,
      installmentNumber: totalInstallmentsCount,
      totalInstallments: totalInstallmentsCount,
      previousDueBefore: currentDue,
      previousCarriedDue: updatedFinancials?.previousCarriedDue ?? 0,
      cumulativePaidAfter: updatedFinancials?.amountPaid ?? paymentAmount,
      remainingDueAfter: updatedFinancials?.outstandingDue ?? Math.max(0, Number((currentDue - paymentAmount).toFixed(2))),
      visitTotalCost: String(updatedFinancials?.totalCost ?? requestedVisit.totalCost),
    };

    // Non-blocking audit log
    logAudit(
      req.user,
      'RECORD_PAYMENT',
      `Payment ${newPayment.paymentId} (৳${paymentAmount}) on Latest Visit ${targetVisitCode}`,
      `Collected by: ${receiverUser?.fullName || collectorId}, Method: ${paymentMethod}, Previous Due: ৳${currentDue}, Remaining Due: ৳${updatedFinancials?.outstandingDue}`
    ).catch((e) => console.error('Audit log error:', e));

    res.status(201).json({
      payment: paymentWithReceiver,
      financials: updatedFinancials,
    });
  } catch (error: any) {
    console.error('Error recording payment:', error);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

apiRouter.get('/payments', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { method, date, fromDate, toDate, receivedBy, search } = req.query;

    const baseQuery = db
      .select({
        id: payments.id,
        paymentId: payments.paymentId,
        patientId: payments.patientId,
        patientCode: patients.patientId,
        patientName: patients.name,
        patientPhone: patients.phone,
        visitId: payments.visitId,
        visitCode: visits.visitId,
        amount: payments.amount,
        paymentMethod: payments.paymentMethod,
        transactionRef: payments.transactionRef,
        notes: payments.notes,
        paymentDate: payments.paymentDate,
        receivedBy: payments.receivedBy,
        receiverName: users.fullName,
        visitTotalCost: visits.totalCost,
        visitAmountPaid: visits.amountPaid,
        visitOutstandingDue: visits.outstandingDue,
        visitDiscount: visits.discount,
        createdAt: payments.createdAt,
      })
      .from(payments)
      .innerJoin(patients, eq(payments.patientId, patients.id))
      .innerJoin(visits, eq(payments.visitId, visits.id))
      .leftJoin(users, eq(payments.receivedBy, users.id));

    const conditions = [];
    if (method && method !== 'All') {
      conditions.push(eq(payments.paymentMethod, method as string));
    }
    if (date) {
      conditions.push(eq(payments.paymentDate, date as string));
    }
    if (fromDate && typeof fromDate === 'string' && fromDate.trim()) {
      conditions.push(sql`${payments.paymentDate} >= ${fromDate.trim()}`);
    }
    if (toDate && typeof toDate === 'string' && toDate.trim()) {
      conditions.push(sql`${payments.paymentDate} <= ${toDate.trim()}`);
    }
    if (receivedBy && receivedBy !== 'All') {
      conditions.push(eq(payments.receivedBy, parseInt(receivedBy as string)));
    }
    if (search && typeof search === 'string') {
      const q = `%${search.trim().toLowerCase()}%`;
      conditions.push(
        or(
          like(sql`LOWER(${patients.name})`, q),
          like(sql`LOWER(${patients.patientId})`, q),
          like(patients.phone, `%${search.trim()}%`),
          like(sql`LOWER(${visits.visitId})`, q),
          like(sql`LOWER(${payments.paymentId})`, q),
          like(sql`LOWER(${payments.transactionRef})`, q)
        )
      );
    }

    const listQuery =
      conditions.length > 0
        ? baseQuery.where(and(...conditions)).orderBy(desc(payments.paymentDate), desc(payments.id))
        : baseQuery.orderBy(desc(payments.paymentDate), desc(payments.id));

    // Parallelize all 3 queries for maximum speed
    const [list, allVisitsChrono, allPaymentRefs] = await Promise.all([
      listQuery,
      db
        .select({
          id: visits.id,
          patientId: visits.patientId,
          totalCost: visits.totalCost,
          amountPaid: visits.amountPaid,
        })
        .from(visits)
        .orderBy(asc(visits.visitDate), asc(visits.id)),
      db
        .select({
          id: payments.id,
          visitId: payments.visitId,
          amount: payments.amount,
          paymentDate: payments.paymentDate,
          visitTotalCost: visits.totalCost,
        })
        .from(payments)
        .innerJoin(visits, eq(payments.visitId, visits.id))
        .orderBy(asc(payments.paymentDate), asc(payments.id)),
    ]);

    const visitStartingPayableMap = new Map<number, { cumulativePayable: number; previousCarriedDue: number }>();
    const patientRunningDueMap = new Map<number, number>();
    for (const v of allVisitsChrono) {
      const prevDue = patientRunningDueMap.get(v.patientId) || 0;
      const vNet = parseFloat(v.totalCost || '0');
      const vPaid = parseFloat(v.amountPaid || '0');
      const cumPayable = Number((prevDue + vNet).toFixed(2));
      const balAfter = Math.max(0, Number((cumPayable - vPaid).toFixed(2)));
      patientRunningDueMap.set(v.patientId, balAfter);
      visitStartingPayableMap.set(v.id, { cumulativePayable: cumPayable, previousCarriedDue: prevDue });
    }

    const paymentInstallmentMap = new Map<number, number>();
    const visitTotalInstallmentsMap = new Map<number, number>();
    const visitRunningPaidMap = new Map<number, number>();
    const paymentRunningMetaMap = new Map<
      number,
      { cumulativePaidAfter: number; remainingDueAfter: number; previousDueBefore: number; previousCarriedDue: number }
    >();

    for (const pr of allPaymentRefs) {
      const nextIdx = (visitTotalInstallmentsMap.get(pr.visitId) || 0) + 1;
      visitTotalInstallmentsMap.set(pr.visitId, nextIdx);
      paymentInstallmentMap.set(pr.id, nextIdx);

      const vStartInfo = visitStartingPayableMap.get(pr.visitId);
      const startingPayable = vStartInfo ? vStartInfo.cumulativePayable : parseFloat(pr.visitTotalCost || '0');
      const prevCarried = vStartInfo ? vStartInfo.previousCarriedDue : 0;
      const prevPaid = visitRunningPaidMap.get(pr.visitId) || 0;
      const amt = parseFloat(pr.amount || '0');
      const prevDue = Math.max(0, Number((startingPayable - prevPaid).toFixed(2)));
      const newPaid = Number((prevPaid + amt).toFixed(2));
      const remDue = Math.max(0, Number((startingPayable - newPaid).toFixed(2)));
      visitRunningPaidMap.set(pr.visitId, newPaid);
      paymentRunningMetaMap.set(pr.id, {
        cumulativePaidAfter: newPaid,
        remainingDueAfter: remDue,
        previousDueBefore: prevDue,
        previousCarriedDue: prevCarried,
      });
    }

    const enrichedPayments = list.map((p) => {
      const meta = paymentRunningMetaMap.get(p.id);
      return {
        ...p,
        installmentNumber: paymentInstallmentMap.get(p.id) || 1,
        totalInstallments: visitTotalInstallmentsMap.get(p.visitId) || 1,
        cumulativePaidAfter: meta?.cumulativePaidAfter ?? parseFloat(p.amount || '0'),
        remainingDueAfter: meta?.remainingDueAfter ?? parseFloat(p.visitOutstandingDue || '0'),
        previousDueBefore: meta?.previousDueBefore ?? parseFloat(p.visitTotalCost || '0'),
        previousCarriedDue: meta?.previousCarriedDue ?? 0,
      };
    });

    res.json(enrichedPayments);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// Pay patient outstanding due according to the latest visit & cumulative patient balance
apiRouter.post('/patients/:id/pay-due', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const patientId = parseInt(req.params.id);
    const { amount, paymentMethod, transactionRef, notes, paymentDate, receivedBy } = req.body;
    const payVal = parseFloat(amount);

    if (isNaN(payVal) || payVal <= 0) {
      return res.status(400).json({ error: 'Payment amount must be greater than 0.' });
    }

    const snapshotMap = await recalculatePatientFinancials(patientId);
    let latestSnapshot: VisitFinancialSnapshot | null = null;
    for (const snap of snapshotMap.values()) {
      if (snap.isLatestVisit) {
        latestSnapshot = snap;
      }
    }

    if (!latestSnapshot || latestSnapshot.outstandingDue <= 0.01) {
      return res.status(400).json({ error: 'This patient has no outstanding dues to pay.' });
    }

    const totalPatientDue = latestSnapshot.outstandingDue;

    if (payVal > totalPatientDue + 0.01) {
      return res.status(400).json({
        error: `Payment amount (৳${payVal}) exceeds total patient outstanding due of ৳${totalPatientDue}.`,
      });
    }

    let collectorId = req.user!.id;
    if (receivedBy) {
      const parsed = parseInt(receivedBy);
      if (!isNaN(parsed) && parsed > 0) {
        collectorId = parsed;
      }
    }

    const [receiverUser] = await db
      .select({ fullName: users.fullName })
      .from(users)
      .where(eq(users.id, collectorId));

    const pDate = paymentDate || new Date().toISOString().split('T')[0];

    const [latestPay] = await db
      .select({ id: payments.id })
      .from(payments)
      .orderBy(desc(payments.id))
      .limit(1);
    const nextPayNumber = 1000 + (latestPay?.id || 0) + 1;
    const generatedPaymentId = `PAY-${nextPayNumber}`;

    const [newPay] = await db
      .insert(payments)
      .values({
        paymentId: generatedPaymentId,
        patientId,
        visitId: latestSnapshot.visitId,
        amount: payVal.toFixed(2),
        paymentMethod: paymentMethod || 'Cash',
        transactionRef: transactionRef?.trim() || null,
        notes: notes?.trim() || null,
        receivedBy: collectorId,
        paymentDate: pDate,
      })
      .returning();

    const updatedSnap = await recalculateVisitFinancials(latestSnapshot.visitId);
    const newRemainingPatientDue = updatedSnap
      ? updatedSnap.outstandingDue
      : Math.max(0, Number((totalPatientDue - payVal).toFixed(2)));

    const createdPayment = {
      ...newPay,
      visitCode: latestSnapshot.visitCode,
      receiverName: receiverUser?.fullName || req.user!.fullName,
      previousDueBefore: totalPatientDue,
      remainingDueAfter: newRemainingPatientDue,
    };

    await logAudit(
      req.user,
      'RECORD_PATIENT_PAYMENT',
      `Payment ${createdPayment.paymentId} (৳${payVal}) for Patient ID ${patientId} on Latest Visit ${latestSnapshot.visitCode}`,
      `Previous Due: ৳${totalPatientDue}, Remaining Due: ৳${newRemainingPatientDue}`
    );

    res.status(201).json({
      payments: [createdPayment],
      totalAllocated: payVal,
      remainingPatientDue: newRemainingPatientDue,
    });
  } catch (error: any) {
    console.error('Error recording combined patient payment:', error);
    res.status(500).json({ error: 'Failed to record patient payment' });
  }
});

// Delete / void a payment record and recalculate visit financials
apiRouter.delete('/payments/:id', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const [existing] = await db.select().from(payments).where(eq(payments.id, id));
    if (!existing) {
      return res.status(404).json({ error: 'Payment record not found' });
    }

    await db.delete(payments).where(eq(payments.id, id));
    const updatedFinancials = await recalculateVisitFinancials(existing.visitId);

    await logAudit(
      req.user,
      'DELETE_PAYMENT',
      `Payment ${existing.paymentId} (৳${existing.amount}) on Visit ID ${existing.visitId}`,
      `Deleted by ${req.user!.fullName} (${req.user!.role})`
    );

    res.json({
      success: true,
      financials: updatedFinancials,
    });
  } catch (error: any) {
    console.error('Error deleting payment:', error);
    res.status(500).json({ error: 'Failed to delete payment record' });
  }
});

// ==========================================
// 8. FOLLOW-UP TRACKING
// ==========================================

apiRouter.get('/appointments', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { status, doctorId, upcomingOnly } = req.query;

    const baseQuery = db
      .select({
        id: appointments.id,
        patientId: appointments.patientId,
        patientCode: patients.patientId,
        patientName: patients.name,
        patientPhone: patients.phone,
        visitId: appointments.visitId,
        doctorId: appointments.doctorId,
        doctorName: users.fullName,
        followUpDate: appointments.followUpDate,
        reason: appointments.reason,
        status: appointments.status,
        notes: appointments.notes,
        createdAt: appointments.createdAt,
      })
      .from(appointments)
      .innerJoin(patients, eq(appointments.patientId, patients.id))
      .innerJoin(users, eq(appointments.doctorId, users.id));

    const conditions = [];
    if (status && status !== 'All') {
      conditions.push(eq(appointments.status, status as string));
    }
    if (doctorId) {
      conditions.push(eq(appointments.doctorId, parseInt(doctorId as string)));
    }
    if (upcomingOnly === 'true') {
      const todayStr = new Date().toISOString().split('T')[0];
      conditions.push(sql`${appointments.followUpDate} >= ${todayStr}`);
    }

    const list = conditions.length > 0
      ? await baseQuery.where(and(...conditions)).orderBy(asc(appointments.followUpDate))
      : await baseQuery.orderBy(desc(appointments.followUpDate));

    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to load follow-ups' });
  }
});

apiRouter.post('/appointments', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const { patientId, visitId, doctorId, followUpDate, reason, notes } = req.body;
    if (!patientId || !followUpDate || !reason) {
      return res.status(400).json({ error: 'Patient, Follow-up Date, and Reason are required.' });
    }

    const [created] = await db
      .insert(appointments)
      .values({
        patientId: parseInt(patientId),
        visitId: visitId ? parseInt(visitId) : null,
        doctorId: doctorId ? parseInt(doctorId) : req.user!.id,
        followUpDate,
        reason: reason.trim(),
        status: 'Scheduled',
        notes: notes?.trim() || null,
      })
      .returning();

    await logAudit(
      req.user,
      'SCHEDULE_FOLLOW_UP',
      `Patient ID ${patientId}`,
      `Scheduled on ${followUpDate}: ${reason}`
    );

    res.status(201).json(created);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to schedule follow-up' });
  }
});

apiRouter.put('/appointments/:id/status', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status, notes } = req.body;

    const [updated] = await db
      .update(appointments)
      .set({
        status,
        notes: notes !== undefined ? notes : undefined,
      })
      .where(eq(appointments.id, id))
      .returning();

    await logAudit(
      req.user,
      'UPDATE_APPOINTMENT_STATUS',
      `Appointment ID ${id}`,
      `Status changed to: ${status}`
    );

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to update follow-up' });
  }
});

// ==========================================
// 9. DASHBOARD STATS (ROLE-SPECIFIC)
// ==========================================

apiRouter.get('/dashboard/stats', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const user = req.user!;
    const todayStr = new Date().toISOString().split('T')[0];

    // Main Doctor & Developer view clinic-wide metrics
    if (user.role === 'main_doctor' || user.role === 'developer') {
      const [totalPatients] = await db.select({ count: count() }).from(patients);
      const [totalDoctors] = await db.select({ count: count() }).from(users).where(eq(users.isActive, true));
      const [totalVisits] = await db.select({ count: count() }).from(visits);
      const [todayVisits] = await db.select({ count: count() }).from(visits).where(eq(visits.visitDate, todayStr));
      const [upcomingFollowUps] = await db
        .select({ count: count() })
        .from(appointments)
        .where(
          and(
            eq(appointments.status, 'Scheduled'),
            sql`${appointments.followUpDate} >= ${todayStr}`
          )
        );

      // Financials
      const visitAggregates = await db
        .select({
          totalTreatment: sql<string>`COALESCE(SUM(total_treatment_cost), 0)`,
          totalTest: sql<string>`COALESCE(SUM(total_test_cost), 0)`,
          totalCost: sql<string>`COALESCE(SUM(total_cost), 0)`,
          totalPaid: sql<string>`COALESCE(SUM(amount_paid), 0)`,
          totalDue: sql<string>`COALESCE(SUM(outstanding_due), 0)`,
        })
        .from(visits);

      // Recent visits
      const recentVisits = await db
        .select({
          id: visits.id,
          visitId: visits.visitId,
          patientId: visits.patientId,
          patientName: patients.name,
          patientCode: patients.patientId,
          doctorName: users.fullName,
          visitDate: visits.visitDate,
          diagnosis: visits.diagnosis,
          totalCost: visits.totalCost,
          amountPaid: visits.amountPaid,
          outstandingDue: visits.outstandingDue,
        })
        .from(visits)
        .innerJoin(patients, eq(visits.patientId, patients.id))
        .innerJoin(users, eq(visits.doctorId, users.id))
        .orderBy(desc(visits.id))
        .limit(6);

      // System records count for Developer
      const developerStats = user.role === 'developer'
        ? {
            totalUsers: (await db.select({ count: count() }).from(users))[0]?.count || 0,
            totalTreatments: (await db.select({ count: count() }).from(treatments))[0]?.count || 0,
            totalDiagnosticTests: (await db.select({ count: count() }).from(diagnosticTests))[0]?.count || 0,
            totalPayments: (await db.select({ count: count() }).from(payments))[0]?.count || 0,
            totalAuditLogs: (await db.select({ count: count() }).from(auditLogs))[0]?.count || 0,
          }
        : null;

      return res.json({
        role: user.role,
        totalPatients: Number(totalPatients?.count || 0),
        totalDoctors: Number(totalDoctors?.count || 0),
        totalVisits: Number(totalVisits?.count || 0),
        todayVisits: Number(todayVisits?.count || 0),
        upcomingFollowUps: Number(upcomingFollowUps?.count || 0),
        totalTreatmentCharges: parseFloat(visitAggregates[0]?.totalTreatment || '0'),
        totalTestCharges: parseFloat(visitAggregates[0]?.totalTest || '0'),
        totalCollection: parseFloat(visitAggregates[0]?.totalPaid || '0'),
        totalOutstandingDues: parseFloat(visitAggregates[0]?.totalDue || '0'),
        recentVisits,
        developerStats,
      });
    }

    // Doctor dashboard (Personal statistics + clinic context)
    const [myVisits] = await db
      .select({ count: count() })
      .from(visits)
      .where(eq(visits.doctorId, user.id));

    const myUniquePatients = await db
      .select({ patientId: visits.patientId })
      .from(visits)
      .where(eq(visits.doctorId, user.id))
      .groupBy(visits.patientId);

    const [myTodayVisits] = await db
      .select({ count: count() })
      .from(visits)
      .where(and(eq(visits.doctorId, user.id), eq(visits.visitDate, todayStr)));

    const [myUpcomingFollowUps] = await db
      .select({ count: count() })
      .from(appointments)
      .where(
        and(
          eq(appointments.doctorId, user.id),
          eq(appointments.status, 'Scheduled'),
          sql`${appointments.followUpDate} >= ${todayStr}`
        )
      );

    const recentVisits = await db
      .select({
        id: visits.id,
        visitId: visits.visitId,
        patientId: visits.patientId,
        patientName: patients.name,
        patientCode: patients.patientId,
        doctorName: users.fullName,
        visitDate: visits.visitDate,
        diagnosis: visits.diagnosis,
        totalCost: visits.totalCost,
        amountPaid: visits.amountPaid,
        outstandingDue: visits.outstandingDue,
      })
      .from(visits)
      .innerJoin(patients, eq(visits.patientId, patients.id))
      .innerJoin(users, eq(visits.doctorId, users.id))
      .where(eq(visits.doctorId, user.id))
      .orderBy(desc(visits.id))
      .limit(6);

    // Treatment breakdown by this doctor
    const treatmentStats = await db
      .select({
        name: treatments.treatmentName,
        count: count(),
        totalEarned: sql<string>`COALESCE(SUM(cost), 0)`,
      })
      .from(treatments)
      .where(eq(treatments.doctorId, user.id))
      .groupBy(treatments.treatmentName)
      .orderBy(desc(count()))
      .limit(5);

    res.json({
      role: 'doctor',
      doctorId: user.id,
      doctorName: user.fullName,
      totalVisits: Number(myVisits?.count || 0),
      uniquePatients: myUniquePatients.length,
      todayVisits: Number(myTodayVisits?.count || 0),
      upcomingFollowUps: Number(myUpcomingFollowUps?.count || 0),
      recentVisits,
      treatmentStats,
    });
  } catch (error: any) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard statistics' });
  }
});

// ==========================================
// 10. CSV EXPORT ENGINE
// ==========================================

function sendCsv(res: Response, filename: string, headers: string[], rows: (string | number)[][]) {
  // Add UTF-8 Byte Order Mark (BOM) for perfect Excel compatibility
  const BOM = '\uFEFF';
  const csvContent =
    BOM +
    headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(',') +
    '\n' +
    rows
      .map((row) =>
        row
          .map((cell) => {
            if (cell === null || cell === undefined) return '""';
            const str = String(cell).replace(/"/g, '""');
            return `"${str}"`;
          })
          .join(',')
      )
      .join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(csvContent);
}

apiRouter.get('/export/patients.csv', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const patientList = await db.select().from(patients).orderBy(asc(patients.id));

    const headers = [
      'Patient ID',
      'Name',
      'Phone',
      'Alternative Phone',
      'Age',
      'Gender',
      'Address',
      'Registration Date',
      'Existing Diseases',
      'Allergies',
      'Visit Count',
      'Total Expenses (BDT)',
      'Total Paid (BDT)',
      'Total Outstanding Due (BDT)',
    ];

    const rows = await Promise.all(
      patientList.map(async (p) => {
        const vRows = await db
          .select({
            cost: visits.totalCost,
            paid: visits.amountPaid,
            due: visits.outstandingDue,
          })
          .from(visits)
          .where(eq(visits.patientId, p.id));

        let totCost = 0;
        let totPaid = 0;
        let totDue = 0;
        for (const v of vRows) {
          totCost += parseFloat(v.cost || '0');
          totPaid += parseFloat(v.paid || '0');
          totDue += parseFloat(v.due || '0');
        }

        return [
          p.patientId,
          p.name,
          p.phone,
          p.altPhone || '',
          p.age || '',
          p.gender,
          p.address || '',
          p.registrationDate,
          p.existingDiseases || '',
          p.allergies || '',
          vRows.length,
          totCost.toFixed(2),
          totPaid.toFixed(2),
          totDue.toFixed(2),
        ];
      })
    );

    await logAudit(req.user, 'EXPORT_CSV', 'Patients CSV', `Exported ${rows.length} patient records`);
    sendCsv(res, `dental_patients_${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
  } catch (error: any) {
    res.status(500).json({ error: 'Export failed' });
  }
});

apiRouter.get('/export/visits.csv', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const visitList = await db
      .select({
        visitId: visits.visitId,
        patientCode: patients.patientId,
        patientName: patients.name,
        doctorName: users.fullName,
        visitDate: visits.visitDate,
        complaints: visits.complaints,
        diagnosis: visits.diagnosis,
        treatmentCost: visits.totalTreatmentCost,
        testCost: visits.totalTestCost,
        additionalCharges: visits.additionalCharges,
        discount: visits.discount,
        totalCost: visits.totalCost,
        amountPaid: visits.amountPaid,
        outstandingDue: visits.outstandingDue,
        nextFollowUpDate: visits.nextFollowUpDate,
        status: visits.status,
      })
      .from(visits)
      .innerJoin(patients, eq(visits.patientId, patients.id))
      .innerJoin(users, eq(visits.doctorId, users.id))
      .orderBy(desc(visits.id));

    const headers = [
      'Visit ID',
      'Patient ID',
      'Patient Name',
      'Attending Doctor',
      'Visit Date',
      'Complaints',
      'Diagnosis',
      'Treatment Charges (BDT)',
      'Test/X-ray Charges (BDT)',
      'Other Charges (BDT)',
      'Discount (BDT)',
      'Total Cost (BDT)',
      'Amount Paid (BDT)',
      'Outstanding Due (BDT)',
      'Next Follow-Up Date',
      'Status',
    ];

    const rows = visitList.map((v) => [
      v.visitId,
      v.patientCode,
      v.patientName,
      v.doctorName,
      v.visitDate,
      v.complaints || '',
      v.diagnosis || '',
      v.treatmentCost,
      v.testCost,
      v.additionalCharges,
      v.discount,
      v.totalCost,
      v.amountPaid,
      v.outstandingDue,
      v.nextFollowUpDate || '',
      v.status,
    ]);

    await logAudit(req.user, 'EXPORT_CSV', 'Visits CSV', `Exported ${rows.length} visit records`);
    sendCsv(res, `dental_visits_${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
  } catch (error: any) {
    res.status(500).json({ error: 'Export failed' });
  }
});

apiRouter.get('/export/payments.csv', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const paymentList = await db
      .select({
        paymentId: payments.paymentId,
        patientCode: patients.patientId,
        patientName: patients.name,
        visitCode: visits.visitId,
        amount: payments.amount,
        paymentMethod: payments.paymentMethod,
        transactionRef: payments.transactionRef,
        notes: payments.notes,
        paymentDate: payments.paymentDate,
        receiverName: users.fullName,
      })
      .from(payments)
      .innerJoin(patients, eq(payments.patientId, patients.id))
      .innerJoin(visits, eq(payments.visitId, visits.id))
      .leftJoin(users, eq(payments.receivedBy, users.id))
      .orderBy(desc(payments.id));

    const headers = [
      'Payment ID',
      'Patient ID',
      'Patient Name',
      'Visit ID',
      'Amount (BDT)',
      'Payment Method',
      'Transaction Reference',
      'Received By',
      'Payment Date',
      'Notes',
    ];

    const rows = paymentList.map((p) => [
      p.paymentId,
      p.patientCode,
      p.patientName,
      p.visitCode,
      p.amount,
      p.paymentMethod,
      p.transactionRef || '',
      p.receiverName || '',
      p.paymentDate,
      p.notes || '',
    ]);

    await logAudit(req.user, 'EXPORT_CSV', 'Payments CSV', `Exported ${rows.length} payment records`);
    sendCsv(res, `dental_payments_${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
  } catch (error: any) {
    res.status(500).json({ error: 'Export failed' });
  }
});

apiRouter.get('/export/diagnostic-tests.csv', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const testList = await db
      .select({
        testId: diagnosticTests.id,
        patientCode: patients.patientId,
        patientName: patients.name,
        visitCode: visits.visitId,
        doctorName: users.fullName,
        testName: diagnosticTests.testName,
        category: diagnosticTests.category,
        cost: diagnosticTests.cost,
        status: diagnosticTests.status,
        testDate: diagnosticTests.testDate,
        notes: diagnosticTests.notes,
      })
      .from(diagnosticTests)
      .innerJoin(patients, eq(diagnosticTests.patientId, patients.id))
      .innerJoin(visits, eq(diagnosticTests.visitId, visits.id))
      .innerJoin(users, eq(diagnosticTests.doctorId, users.id))
      .orderBy(desc(diagnosticTests.id));

    const headers = [
      'Test Record ID',
      'Patient ID',
      'Patient Name',
      'Visit ID',
      'Referring Doctor',
      'Test/X-ray Name',
      'Category',
      'Cost (BDT)',
      'Status',
      'Test Date',
      'Notes',
    ];

    const rows = testList.map((t) => [
      t.testId,
      t.patientCode,
      t.patientName,
      t.visitCode,
      t.doctorName,
      t.testName,
      t.category,
      t.cost,
      t.status,
      t.testDate,
      t.notes || '',
    ]);

    await logAudit(req.user, 'EXPORT_CSV', 'Diagnostic Tests CSV', `Exported ${rows.length} test records`);
    sendCsv(res, `dental_tests_xrays_${new Date().toISOString().split('T')[0]}.csv`, headers, rows);
  } catch (error: any) {
    res.status(500).json({ error: 'Export failed' });
  }
});

// ==========================================
// 11. AUDIT LOGS
// ==========================================

apiRouter.get(
  '/audit-logs',
  authenticateToken,
  requireRoles('main_doctor', 'developer'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const logs = await db
        .select({
          id: auditLogs.id,
          userId: auditLogs.userId,
          userRole: auditLogs.userRole,
          userName: users.fullName,
          username: users.username,
          action: auditLogs.action,
          affectedRecord: auditLogs.affectedRecord,
          details: auditLogs.details,
          createdAt: auditLogs.createdAt,
        })
        .from(auditLogs)
        .leftJoin(users, eq(auditLogs.userId, users.id))
        .orderBy(desc(auditLogs.id))
        .limit(100);

      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
  }
);

// ==========================================
// 12. CLINIC SETTINGS & DEFAULT PRICING
// ==========================================

apiRouter.get('/settings', authenticateToken, async (req: AuthenticatedRequest, res) => {
  try {
    const list = await db.select().from(systemSettings);
    const map: Record<string, string> = {};
    for (const item of list) {
      map[item.key] = item.value;
    }
    res.json(map);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

apiRouter.put(
  '/settings',
  authenticateToken,
  requireRoles('main_doctor', 'developer'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const { settings } = req.body;
      if (!settings || typeof settings !== 'object') {
        return res.status(400).json({ error: 'Invalid settings object' });
      }

      for (const [key, value] of Object.entries(settings)) {
        const valStr = typeof value === 'string' ? value : JSON.stringify(value);
        await db
          .insert(systemSettings)
          .values({ key, value: valStr })
          .onConflictDoUpdate({
            target: systemSettings.key,
            set: { value: valStr, updatedAt: new Date() },
          });
      }

      await logAudit(
        req.user,
        'UPDATE_SETTINGS',
        'Clinic Configuration & Default Prices',
        `Updated settings keys: ${Object.keys(settings).join(', ')}`
      );

      res.json({ success: true, message: 'Settings saved' });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to save settings' });
    }
  }
);

// ==========================================
// 13. DEVELOPER BACKUP & RESTORE
// ==========================================

apiRouter.get(
  '/developer/backup',
  authenticateToken,
  requireRoles('developer'),
  async (req: AuthenticatedRequest, res) => {
    try {
      const allUsers = await db.select().from(users);
      const allPatients = await db.select().from(patients);
      const allVisits = await db.select().from(visits);
      const allTreatments = await db.select().from(treatments);
      const allTests = await db.select().from(diagnosticTests);
      const allPayments = await db.select().from(payments);
      const allAppointments = await db.select().from(appointments);
      const allSettings = await db.select().from(systemSettings);
      const allAuditLogs = await db.select().from(auditLogs);

      const backupData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        tables: {
          users: allUsers,
          patients: allPatients,
          visits: allVisits,
          treatments: allTreatments,
          diagnosticTests: allTests,
          payments: allPayments,
          appointments: allAppointments,
          systemSettings: allSettings,
          auditLogs: allAuditLogs,
        },
      };

      await logAudit(req.user, 'DATABASE_BACKUP', 'PostgreSQL Cloud SQL Database', 'Full JSON snapshot downloaded');

      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="dental_system_backup_${new Date().toISOString().split('T')[0]}.json"`
      );
      res.send(JSON.stringify(backupData, null, 2));
    } catch (error: any) {
      res.status(500).json({ error: 'Database backup failed' });
    }
  }
);
