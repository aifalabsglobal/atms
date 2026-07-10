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

  console.log(`\n${passed}/${passed} unit checks passed`);
} catch (err) {
  console.error(`  ✗ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}
