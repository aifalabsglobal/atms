import { NextResponse } from 'next/server';
import { requireMastersRead, requireMastersWrite, auditMasterMutation } from '@/lib/masters-helpers';
import { JNTU_R22_CSE_CATALOG } from '@/data/jntu-r22-cse-catalog';
import { JNTU_R22_ECE_CATALOG } from '@/data/jntu-r22-ece-catalog';
import { importJntuSubjects, resolveDepartmentId } from '@/lib/jntu-import';
import { publishSubjectToLms } from '@/lib/masters-sync';
import type { JntuImportSubject } from '@/data/jntu-r22-cse-catalog';
import { db } from '@/lib/db';

const CATALOGS = {
  'r22-cse': JNTU_R22_CSE_CATALOG,
  'r22-ece': JNTU_R22_ECE_CATALOG,
} as const;

export async function GET() {
  try {
    const { error } = await requireMastersRead();
    if (error) return error;

    return NextResponse.json({
      catalogs: Object.entries(CATALOGS).map(([key, c]) => ({
        key,
        name: c.name,
        regulation: c.regulation,
        departmentCode: c.departmentCode,
        subjectCount: c.subjects.length,
      })),
    });
  } catch (err) {
    console.error('Import catalogs error:', err);
    return NextResponse.json({ error: 'Failed to load catalogs' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { error, session } = await requireMastersWrite();
    if (error || !session) return error;

    const body = await request.json();
    const {
      catalog,
      subjects: customSubjects,
      departmentId,
      departmentCode,
      academicYearId,
      updateExisting = true,
      dryRun = false,
      publishToLms = false,
      programId,
    } = body;

    let rows: JntuImportSubject[] = [];
    let resolvedDeptCode = departmentCode;

    if (catalog) {
      const bundled = CATALOGS[catalog as keyof typeof CATALOGS];
      if (!bundled) {
        return NextResponse.json({ error: `Unknown catalog: ${catalog}` }, { status: 400 });
      }
      rows = [...bundled.subjects];
      resolvedDeptCode = resolvedDeptCode || bundled.departmentCode;
    } else if (Array.isArray(customSubjects) && customSubjects.length > 0) {
      rows = customSubjects;
    } else {
      return NextResponse.json(
        { error: 'Provide catalog key (e.g. "r22-cse", "r22-ece") or a subjects array' },
        { status: 400 }
      );
    }

    if (publishToLms && !programId) {
      return NextResponse.json({ error: 'programId is required when publishToLms is true' }, { status: 400 });
    }

    const deptId = await resolveDepartmentId(
      departmentId ? undefined : resolvedDeptCode,
      departmentId
    );
    const summary = await importJntuSubjects(rows, {
      departmentId: deptId,
      academicYearId,
      updateExisting,
      dryRun,
    });

    let publishedCourses = 0;
    const publishErrors: string[] = [];

    if (publishToLms && !dryRun && summary.importedCodes.length > 0) {
      for (const code of summary.importedCodes) {
        try {
          const subject = await db.subject.findUnique({ where: { code } });
          if (subject) {
            await publishSubjectToLms(subject.id, programId);
            publishedCourses++;
          }
        } catch (e) {
          publishErrors.push(`${code}: ${e instanceof Error ? e.message : 'failed'}`);
        }
      }
    }

    if (!dryRun) {
      await auditMasterMutation(request, session.user.id, 'masters.subject.import', `department:${deptId}`, {
        catalog: catalog || 'custom',
        created: summary.created,
        updated: summary.updated,
        skipped: summary.skipped,
        errors: summary.errors,
        publishToLms,
        publishedCourses,
      });
    }

    return NextResponse.json({
      ...summary,
      dryRun,
      catalog: catalog || 'custom',
      total: rows.length,
      publishedCourses,
      publishErrors,
    });
  } catch (err) {
    console.error('Subject import error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Import failed' },
      { status: 500 }
    );
  }
}
