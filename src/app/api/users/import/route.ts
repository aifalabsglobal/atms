import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import {
  requireUserManagement,
  getCampusScope,
} from '@/lib/auth-helpers';
import type { Role } from '@/lib/store';
import { logAudit, getClientIp } from '@/lib/audit';
import { enforceRateLimit } from '@/lib/rate-limit';
import {
  ALL_ROLES,
  canAssignRole,
  generateTempPassword,
} from '@/lib/user-management';

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      row.push(cell.trim());
      cell = '';
      continue;
    }
    if (ch === '\n' || (ch === '\r' && next === '\n')) {
      row.push(cell.trim());
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
      cell = '';
      if (ch === '\r') i++;
      continue;
    }
    if (ch === '\r') {
      row.push(cell.trim());
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    cell += ch;
  }
  row.push(cell.trim());
  if (row.some((c) => c.length > 0)) rows.push(row);
  return rows;
}

export async function POST(request: Request) {
  try {
    const limited = await enforceRateLimit(`users-import:${getClientIp(request) ?? 'anon'}`, 5, 60_000);
    if (limited) return limited;

    const { error, session } = await requireUserManagement();
    if (error || !session) return error;

    const actorRole = session.user.role as Role;
    if (actorRole !== 'super_admin' && actorRole !== 'admin') {
      return NextResponse.json({ error: 'Only admins can import users' }, { status: 403 });
    }

    const scope = await getCampusScope(session);
    const body = await request.json();
    const csv = typeof body.csv === 'string' ? body.csv : '';
    if (!csv.trim()) {
      return NextResponse.json({ error: 'csv text is required' }, { status: 400 });
    }

    const rows = parseCsv(csv);
    if (rows.length < 2) {
      return NextResponse.json({ error: 'CSV needs a header row and at least one data row' }, { status: 400 });
    }

    const header = rows[0].map((h) => h.toLowerCase().replace(/\s+/g, '_'));
    const idx = (name: string) => header.indexOf(name);
    const emailIdx = idx('email');
    const nameIdx = idx('name');
    const roleIdx = idx('role');
    if (emailIdx < 0 || nameIdx < 0 || roleIdx < 0) {
      return NextResponse.json(
        { error: 'CSV header must include email, name, and role columns' },
        { status: 400 },
      );
    }

    const phoneIdx = idx('phone');
    const employeeIdx = idx('employee_id') >= 0 ? idx('employee_id') : idx('employeeid');
    const departmentIdx = idx('department');

    const { getAuthSettings } = await import('@/lib/settings/auth-config');
    const authSettings = await getAuthSettings();

    const created: { email: string; tempPassword: string }[] = [];
    const skipped: { email: string; reason: string }[] = [];

    for (const raw of rows.slice(1)) {
      const email = (raw[emailIdx] || '').trim().toLowerCase();
      const name = (raw[nameIdx] || '').trim();
      const role = (raw[roleIdx] || '').trim() as Role;
      const phone = phoneIdx >= 0 ? (raw[phoneIdx] || '').trim() || null : null;
      const employeeId = employeeIdx >= 0 ? (raw[employeeIdx] || '').trim() || null : null;
      const department = departmentIdx >= 0 ? (raw[departmentIdx] || '').trim() || null : null;

      if (!email || !name || !role) {
        skipped.push({ email: email || '(missing)', reason: 'email, name, and role are required' });
        continue;
      }
      if (!ALL_ROLES.includes(role)) {
        skipped.push({ email, reason: `invalid role: ${role}` });
        continue;
      }
      if (!canAssignRole(actorRole, role)) {
        skipped.push({ email, reason: 'you cannot assign this role' });
        continue;
      }

      const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
      if (existing) {
        skipped.push({ email, reason: 'email already registered' });
        continue;
      }

      let resolvedDeptId: string | null = null;
      let resolvedDept = department;
      if (scope.level === 'department') {
        resolvedDeptId = scope.departmentId;
        const dept = await db.department.findUnique({
          where: { id: scope.departmentId },
          select: { name: true },
        });
        resolvedDept = dept?.name ?? resolvedDept;
      } else if (department) {
        const dept = await db.department.findFirst({
          where: { OR: [{ name: department }, { code: department }] },
          select: { id: true, name: true },
        });
        if (dept) {
          resolvedDeptId = dept.id;
          resolvedDept = dept.name;
        }
      }

      const tempPassword = generateTempPassword(authSettings.tempPasswordLength);
      const passwordHash = await bcrypt.hash(tempPassword, 10);
      const user = await db.user.create({
        data: {
          email,
          name,
          role,
          phone,
          employeeId,
          department: resolvedDept,
          departmentId: resolvedDeptId,
          passwordHash,
          status: 'active',
        },
        select: { id: true, email: true },
      });
      created.push({ email: user.email, tempPassword });
    }

    await logAudit({
      userId: session.user.id,
      action: 'user.import',
      resource: 'users',
      details: { created: created.length, skipped: skipped.length },
      ipAddress: getClientIp(request),
    });

    return NextResponse.json({
      created: created.length,
      skipped: skipped.length,
      results: { created, skipped },
    });
  } catch (error) {
    console.error('Users import error:', error);
    return NextResponse.json({ error: 'Failed to import users' }, { status: 500 });
  }
}
