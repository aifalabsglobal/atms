/**
 * Fast unit checks (no DB) — run: npm run test:unit
 */
import {
  attendanceRiskStatus,
  buildViolationAnalytics,
  buildWeeklyTrend,
} from '../src/lib/reports-analytics';
import {
  captureMethodRequiresGeofence,
  checkLocationAgainstSessionGeofence,
} from '../src/lib/geofence-policy';
import { verifyMfaToken, generateMfaSecret, generateMfaToken } from '../src/lib/mfa';
import { getFaceVerificationMode, isFaceVerificationApiConfigured } from '../src/lib/face-verification';
import {
  getSettingDefinition,
  listSettingCategories,
  listSettingDefinitions,
  validateSettingValue,
} from '../src/lib/settings/registry';
import {
  settingsCacheGet,
  settingsCacheInvalidate,
  settingsCacheSet,
} from '../src/lib/settings/cache';
import { resolveEffectiveValue } from '../src/lib/settings/resolve';
import { parseSystemConfig, validateSystemConfig } from '../src/lib/system-config-defaults';
import { canAccessSectionSync, cloneDefaultMatrix, validateRbacMatrix } from '../src/lib/rbac-defaults';

let passed = 0;

function assert(name: string, condition: boolean) {
  if (!condition) throw new Error(name);
  passed++;
  console.log(`  ✓ ${name}`);
}

try {
  assert('self_geo_face requires geofence', captureMethodRequiresGeofence('self_geo_face'));
  assert('manual does not require geofence', !captureMethodRequiresGeofence('manual'));

  const inside = checkLocationAgainstSessionGeofence(
    { name: 'CSE', type: 'circle', centerLat: 17.4497, centerLng: 78.6674, radiusMtrs: 200 },
    17.4497,
    78.6674,
  );
  assert('inside circle geofence', inside.inside && inside.requiresGeofence);

  assert('risk on_track at 80%', attendanceRiskStatus(80, 10) === 'on_track');
  assert('risk at_risk at 50%', attendanceRiskStatus(50, 10) === 'at_risk');
  assert('risk no_data', attendanceRiskStatus(100, 0) === 'no_data');

  const trend = buildWeeklyTrend([
    { sessionDate: '2026-07-01', presentCount: 8, absentCount: 2, lateCount: 0, expectedCount: 10 },
    { sessionDate: '2026-07-02', presentCount: 7, absentCount: 3, lateCount: 0, expectedCount: 10 },
  ]);
  assert('weekly trend has rate', trend.length >= 1 && typeof trend[0].rate === 'number');

  const va = buildViolationAnalytics([
    { type: 'spoof', severity: 'high', reviewStatus: 'pending' },
    { type: 'spoof', severity: 'low', reviewStatus: 'confirmed' },
  ]);
  assert('violation analytics pending', va.pending === 1 && va.confirmed === 1 && va.total === 2);

  assert('face mode disabled by default in unit env', getFaceVerificationMode() === 'disabled');
  assert('face api not configured without env', !isFaceVerificationApiConfigured());

  const secret = generateMfaSecret();
  const token = generateMfaToken(secret);
  assert('mfa verify accepts current totp', verifyMfaToken(secret, token));
  assert('mfa reject non-numeric', !verifyMfaToken(secret, 'abcdef'));

  // Settings registry + validation
  const eligibility = getSettingDefinition('attendance.eligibility_pct');
  assert('registry has eligibility key', !!eligibility && eligibility.valueType === 'number');
  assert('eligibility 75 valid', validateSettingValue(eligibility!, 75) === null);
  assert('eligibility 101 rejected', validateSettingValue(eligibility!, 101) !== null);
  assert('eligibility string rejected', validateSettingValue(eligibility!, '75') !== null);

  const theme = getSettingDefinition('general.theme');
  assert('theme enum accepts light', validateSettingValue(theme!, 'light') === null);
  assert('theme enum rejects neon', validateSettingValue(theme!, 'neon') !== null);

  const demoFlag = getSettingDefinition('flags.demo_auth_visible');
  assert('env-only flag not writable', validateSettingValue(demoFlag!, true) !== null);

  const cats = listSettingCategories();
  assert('categories include attendance', cats.some((c) => c.id === 'attendance' && c.keys.length > 0));
  assert('phase1 definitions registered', listSettingDefinitions().length >= 15);
  assert('rbac.matrix registered', !!getSettingDefinition('rbac.matrix'));

  // Resolution order: env → user → department → organization → global → default
  const layers = [
    { scope: 'global' as const, scopeId: '', value: 75 },
    { scope: 'organization' as const, scopeId: 'org1', value: 70 },
    { scope: 'department' as const, scopeId: 'dept1', value: 65 },
    { scope: 'user' as const, scopeId: 'u1', value: 60 },
  ];
  assert(
    'resolve defaults when empty',
    resolveEffectiveValue({ defaultValue: 80, layers: [] }).source === 'default'
      && resolveEffectiveValue({ defaultValue: 80, layers: [] }).value === 80,
  );
  assert(
    'resolve prefers global over default',
    resolveEffectiveValue({ defaultValue: 80, layers: [layers[0]] }).source === 'global'
      && resolveEffectiveValue({ defaultValue: 80, layers: [layers[0]] }).value === 75,
  );
  assert(
    'resolve prefers user over department/global',
    resolveEffectiveValue({
      defaultValue: 80,
      layers,
      userId: 'u1',
      departmentId: 'dept1',
      organizationId: 'org1',
    }).value === 60,
  );
  assert(
    'resolve prefers env over user',
    resolveEffectiveValue({
      defaultValue: 80,
      envValue: 99,
      layers,
      userId: 'u1',
    }).source === 'env' && resolveEffectiveValue({
      defaultValue: 80,
      envValue: 99,
      layers,
      userId: 'u1',
    }).value === 99,
  );
  assert(
    'resolve department when no user layer',
    resolveEffectiveValue({
      defaultValue: 80,
      layers,
      departmentId: 'dept1',
    }).value === 65,
  );

  // Settings cache invalidation
  settingsCacheSet('eff:test:key', { value: 1 }, 60_000);
  assert('cache hit', settingsCacheGet<{ value: number }>('eff:test:key')?.value === 1);
  settingsCacheInvalidate('eff:test');
  assert('cache invalidated by prefix', settingsCacheGet('eff:test:key') === null);
  settingsCacheSet('eff:other', 2, 60_000);
  settingsCacheInvalidate();
  assert('cache clear all', settingsCacheGet('eff:other') === null);

  // Legacy system-config / RBAC paths still validate (adapters feed these shapes)
  const cfg = parseSystemConfig({
    attendance: { eligibilityPct: 80, condonationPct: 70, requireHodForCondonation: true },
  });
  assert('system config parse eligibility', cfg.attendance.eligibilityPct === 80);
  assert('system config validate ok', !('error' in validateSystemConfig(cfg)));

  const matrix = cloneDefaultMatrix();
  assert('rbac matrix validates', !('error' in validateRbacMatrix(matrix)));
  assert('super_admin has settings section', canAccessSectionSync('super_admin', 'settings', matrix));
  assert('student lacks settings section', !canAccessSectionSync('student', 'settings', matrix));

  console.log(`\n${passed}/${passed} unit checks passed`);
} catch (err) {
  console.error(`  ✗ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}
