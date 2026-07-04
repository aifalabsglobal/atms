import { validateGeofenceLocation, type GeofenceShape } from '@/lib/geofence';

/** Capture methods that require an active geofence on the session. */
export const GEO_CAPTURE_METHODS = ['gps', 'self_geo_face'] as const;

export type GeoCaptureMethod = (typeof GEO_CAPTURE_METHODS)[number];

export function captureMethodRequiresGeofence(method: string): boolean {
  return (GEO_CAPTURE_METHODS as readonly string[]).includes(method);
}

export function captureMethodRequiresLocation(method: string): boolean {
  return captureMethodRequiresGeofence(method);
}

export type GeofencePickerOption = {
  id: string;
  name: string;
  building?: string | null;
  isActive?: boolean;
};

/** Match geofence by building label (e.g. timetable slot building → CSE Block Zone). */
export function suggestGeofenceForBuilding(
  geofences: GeofencePickerOption[],
  building?: string | null,
): GeofencePickerOption | null {
  if (!building?.trim()) return null;
  const needle = building.trim().toLowerCase();
  const active = geofences.filter((g) => g.isActive !== false);
  return (
    active.find((g) => g.building?.toLowerCase() === needle) ??
    active.find((g) => g.building?.toLowerCase().includes(needle) || needle.includes(g.building?.toLowerCase() ?? '')) ??
    active.find((g) => g.name.toLowerCase().includes(needle.split(' ')[0])) ??
    null
  );
}

export type GeofenceCheckResult = {
  inside: boolean;
  distanceFromCenter: number | null;
  geofenceName: string;
  radius: number | null;
  requiresGeofence: boolean;
};

export type SessionGeofence = {
  name: string;
  type?: string | null;
  centerLat?: number | null;
  centerLng?: number | null;
  radiusMtrs?: number | null;
  polygonData?: string | null;
};

export function checkLocationAgainstSessionGeofence(
  geofence: SessionGeofence | null | undefined,
  latitude: number,
  longitude: number,
): GeofenceCheckResult {
  if (!geofence) {
    return {
      inside: true,
      distanceFromCenter: null,
      geofenceName: '',
      radius: null,
      requiresGeofence: false,
    };
  }

  const shape: GeofenceShape & { name: string; radiusMtrs?: number | null } = {
    type: geofence.type ?? 'circle',
    centerLat: geofence.centerLat,
    centerLng: geofence.centerLng,
    radiusMtrs: geofence.radiusMtrs,
    polygonData: geofence.polygonData,
    name: geofence.name,
  };

  const { validated, distanceFromCenter } = validateGeofenceLocation(shape, latitude, longitude);
  return {
    inside: validated,
    distanceFromCenter,
    geofenceName: geofence.name,
    radius: geofence.type === 'polygon' ? null : (geofence.radiusMtrs ?? 100),
    requiresGeofence: true,
  };
}

export function geofenceStatusLabel(check: GeofenceCheckResult | null): string {
  if (!check?.requiresGeofence) return 'No geofence required for this session';
  if (!check.inside) {
    if (check.radius != null && check.distanceFromCenter != null) {
      return `${Math.round(check.distanceFromCenter)}m away — must be within ${check.radius}m of ${check.geofenceName}`;
    }
    return `Outside ${check.geofenceName}`;
  }
  if (check.distanceFromCenter != null && check.radius != null) {
    return `Inside ${check.geofenceName} (${Math.round(check.distanceFromCenter)}m / ${check.radius}m)`;
  }
  return `Inside ${check.geofenceName}`;
}
