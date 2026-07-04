import { db } from '@/lib/db';
import { validateSubjectCode, validateCategory, validateSubjectLtp } from '@/lib/masters-validation';
import type { JntuImportSubject } from '@/data/jntu-r22-cse-catalog';

export type ImportRowResult = {
  code: string;
  status: 'created' | 'updated' | 'skipped' | 'error';
  message?: string;
};

export type ImportSummary = {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
  importedCodes: string[];
  results: ImportRowResult[];
};

export async function resolveDepartmentId(departmentCode?: string, departmentId?: string) {
  if (departmentId) {
    const dept = await db.department.findUnique({ where: { id: departmentId } });
    if (!dept) throw new Error('Department not found');
    return dept.id;
  }
  if (departmentCode) {
    const dept = await db.department.findFirst({
      where: { OR: [{ code: departmentCode }, { code: { contains: departmentCode } }] },
    });
    if (!dept) throw new Error(`Department not found for code: ${departmentCode}`);
    return dept.id;
  }
  throw new Error('departmentId or departmentCode is required');
}

async function resolveSemesterId(semesterCode?: string, academicYearId?: string) {
  if (!semesterCode) return null;
  const where: Record<string, unknown> = { code: semesterCode };
  if (academicYearId) where.academicYearId = academicYearId;
  const semester = await db.semester.findFirst({ where });
  if (!semester) return null;
  return semester.id;
}

function validateImportRow(row: JntuImportSubject): string | null {
  if (!row.code?.trim() || !row.name?.trim()) {
    return 'code and name are required';
  }
  const codeErr = validateSubjectCode(row.code);
  if (codeErr) return codeErr;
  const catErr = validateCategory(row.category);
  if (catErr) return catErr;
  const ltpErr = validateSubjectLtp({
    type: row.type || 'core',
    lectureHours: row.lectureHours ?? 3,
    tutorialHours: row.tutorialHours ?? 0,
    labHours: row.labHours ?? 0,
    credits: row.credits ?? 3,
  });
  if (ltpErr) return ltpErr;
  return null;
}

export async function importJntuSubjects(
  subjects: JntuImportSubject[],
  opts: {
    departmentId: string;
    academicYearId?: string;
    updateExisting?: boolean;
    dryRun?: boolean;
  }
): Promise<ImportSummary> {
  const summary: ImportSummary = { created: 0, updated: 0, skipped: 0, errors: 0, importedCodes: [], results: [] };

  for (const row of subjects) {
    const code = String(row.code).trim().toUpperCase();
    try {
      const validationError = validateImportRow({ ...row, code });
      if (validationError) {
        summary.errors++;
        summary.results.push({ code, status: 'error', message: validationError });
        continue;
      }

      const semesterId = await resolveSemesterId(row.semesterCode, opts.academicYearId);
      if (row.semesterCode && !semesterId) {
        summary.errors++;
        summary.results.push({ code, status: 'error', message: `Semester not found: ${row.semesterCode}` });
        continue;
      }

      const existing = await db.subject.findUnique({ where: { code } });
      if (existing && !opts.updateExisting) {
        summary.skipped++;
        summary.results.push({ code, status: 'skipped', message: 'Already exists' });
        continue;
      }

      const data = {
        code,
        name: row.name.trim(),
        departmentId: opts.departmentId,
        semesterId,
        credits: row.credits ?? 3,
        lectureHours: row.lectureHours ?? 3,
        tutorialHours: row.tutorialHours ?? 0,
        labHours: row.labHours ?? 0,
        type: row.type || 'core',
        category: row.category || null,
        syllabus: row.syllabus || null,
        textbooks: row.textbooks || null,
        referenceBooks: row.referenceBooks || null,
        isActive: true,
      };

      if (opts.dryRun) {
        summary.results.push({ code, status: existing ? 'updated' : 'created', message: 'dry-run' });
        summary.importedCodes.push(code);
        if (existing) summary.updated++;
        else summary.created++;
        continue;
      }

      if (existing) {
        await db.subject.update({ where: { id: existing.id }, data });
        summary.updated++;
        summary.importedCodes.push(code);
        summary.results.push({ code, status: 'updated' });
      } else {
        await db.subject.create({ data });
        summary.created++;
        summary.importedCodes.push(code);
        summary.results.push({ code, status: 'created' });
      }
    } catch (err) {
      summary.errors++;
      summary.results.push({
        code,
        status: 'error',
        message: err instanceof Error ? err.message : 'Import failed',
      });
    }
  }

  return summary;
}
