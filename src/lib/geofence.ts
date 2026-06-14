export type LatLng = { lat: number; lng: number };

export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function parsePolygonData(polygonData: string | null | undefined): LatLng[] | null {
  if (!polygonData) return null;
  try {
    const parsed = JSON.parse(polygonData) as unknown;
    if (Array.isArray(parsed) && parsed.length >= 3) {
      return parsed as LatLng[];
    }
  } catch {
    return null;
  }
  return null;
}

/** Ray-casting point-in-polygon test. */
export function pointInPolygon(point: LatLng, polygon: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;
    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export type GeofenceShape = {
  type: string;
  centerLat?: number | null;
  centerLng?: number | null;
  radiusMtrs?: number | null;
  polygonData?: string | null;
};

export function validateGeofenceLocation(
  geofence: GeofenceShape,
  latitude: number,
  longitude: number
): { validated: boolean; distanceFromCenter: number | null } {
  if (geofence.type === 'polygon') {
    const polygon = parsePolygonData(geofence.polygonData);
    if (!polygon) return { validated: false, distanceFromCenter: null };
    return {
      validated: pointInPolygon({ lat: latitude, lng: longitude }, polygon),
      distanceFromCenter: null,
    };
  }

  if (geofence.centerLat != null && geofence.centerLng != null) {
    const distanceFromCenter = haversineDistance(
      latitude,
      longitude,
      geofence.centerLat,
      geofence.centerLng
    );
    const radius = geofence.radiusMtrs ?? 100;
    return { validated: distanceFromCenter <= radius, distanceFromCenter };
  }

  return { validated: false, distanceFromCenter: null };
}
