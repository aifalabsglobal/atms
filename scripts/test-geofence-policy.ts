/**
 * Geofence policy unit checks — run: npm run test:geofence
 */
import {
  captureMethodRequiresGeofence,
  suggestGeofenceForBuilding,
  checkLocationAgainstSessionGeofence,
} from '../src/lib/geofence-policy';

let passed = 0;

function assert(name: string, condition: boolean) {
  if (!condition) throw new Error(name);
  passed++;
  console.log(`  ✓ ${name}`);
}

try {
  assert('self_geo_face requires geofence', captureMethodRequiresGeofence('self_geo_face'));
  assert('manual does not require geofence', !captureMethodRequiresGeofence('manual'));

  const geofences = [
    { id: '1', name: 'CSE Block Zone', building: 'CSE Block', isActive: true },
    { id: '2', name: 'ECE Block Zone', building: 'ECE Block', isActive: true },
  ];
  assert(
    'suggest geofence by building',
    suggestGeofenceForBuilding(geofences, 'CSE Block')?.id === '1',
  );

  const inside = checkLocationAgainstSessionGeofence(
    { name: 'CSE', type: 'circle', centerLat: 17.4497, centerLng: 78.6674, radiusMtrs: 200 },
    17.4497,
    78.6674,
  );
  assert('inside circle geofence', inside.inside && inside.requiresGeofence);

  const noFence = checkLocationAgainstSessionGeofence(null, 1, 2);
  assert('no geofence allows mark path', noFence.inside && !noFence.requiresGeofence);

  console.log(`\n${passed}/${passed} geofence policy checks passed`);
} catch (err) {
  console.error(`  ✗ ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}
