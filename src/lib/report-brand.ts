import type { GeneralSettings } from '@/lib/settings/general-defaults';
import type { OrgSettings } from '@/lib/settings/org-defaults';
import type { ActiveAcademicYearSummary } from '@/lib/settings/academic-year-range';

/** Shared brand block for CSV + PDF report exports. */
export type ReportDocumentBrand = {
  appName: string;
  companyName: string;
  locale: string;
  brandingPrimaryColor: string;
  logoUrl?: string;
  campusCode?: string;
  aisheCode?: string;
  campusAddress?: string;
  campusPhone?: string;
  principalTitle?: string;
  academicYearLabel?: string;
};

export function buildReportBrand(
  general: Pick<
    GeneralSettings,
    'appName' | 'companyName' | 'locale' | 'brandingPrimaryColor' | 'logoUrl'
  >,
  organization?: Pick<
    OrgSettings,
    'campusCode' | 'aisheCode' | 'campusAddress' | 'campusPhone' | 'principalTitle'
  > | null,
  activeAcademicYear?: ActiveAcademicYearSummary | null,
): ReportDocumentBrand {
  const ayLabel = activeAcademicYear
    ? activeAcademicYear.regulation
      ? `${activeAcademicYear.name} · ${activeAcademicYear.regulation}`
      : activeAcademicYear.name
    : undefined;

  return {
    appName: general.appName,
    companyName: general.companyName,
    locale: general.locale || 'en-IN',
    brandingPrimaryColor: general.brandingPrimaryColor,
    logoUrl: general.logoUrl || undefined,
    campusCode: organization?.campusCode || undefined,
    aisheCode: organization?.aisheCode || undefined,
    campusAddress: organization?.campusAddress || undefined,
    campusPhone: organization?.campusPhone || undefined,
    principalTitle: organization?.principalTitle || undefined,
    academicYearLabel: ayLabel,
  };
}

/** Identity lines for letterhead preview / CSV meta rows. */
export function reportIdentityLines(brand: ReportDocumentBrand): string[] {
  const lines: string[] = [];
  if (brand.companyName) lines.push(brand.companyName);
  const codes = [brand.campusCode, brand.aisheCode ? `AISHE ${brand.aisheCode}` : '']
    .filter(Boolean)
    .join(' · ');
  if (codes) lines.push(codes);
  if (brand.campusAddress) lines.push(brand.campusAddress);
  if (brand.campusPhone) lines.push(`Phone: ${brand.campusPhone}`);
  if (brand.principalTitle) lines.push(brand.principalTitle);
  if (brand.academicYearLabel) lines.push(brand.academicYearLabel);
  return lines;
}

export function formatCampusIdentityPreview(
  organization: Pick<
    OrgSettings,
    'campusCode' | 'aisheCode' | 'campusAddress' | 'campusPhone' | 'principalTitle'
  >,
  companyName = 'Institute',
): string {
  const parts = [
    companyName,
    organization.campusCode || null,
    organization.aisheCode ? `AISHE ${organization.aisheCode}` : null,
    organization.campusAddress || null,
    organization.campusPhone || null,
    organization.principalTitle || null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : 'Add campus code, AISHE ID, address, phone, and principal title for report letterheads.';
}
