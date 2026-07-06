'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  MapPin, Plus, Building2, Circle, Pentagon, ToggleLeft, ToggleRight,
  Navigation, ScanFace, CheckCircle2, XCircle, Clock, ShieldCheck,
  ShieldAlert, Loader2, Crosshair, Maximize2, UserCheck, AlertTriangle,
  Pencil, Trash2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAppStore, GEOFENCE_WRITE_ROLES, useEffectiveSections } from '@/lib/store';
import { parsePolygonData } from '@/lib/geofence';
import {
  captureMethodRequiresGeofence,
  checkLocationAgainstSessionGeofence,
  geofenceStatusLabel,
  type GeofenceCheckResult,
} from '@/lib/geofence-policy';
import { cn } from '@/lib/utils';
import type { GeofenceItem } from '@/lib/types';

async function fetchGeofences(includeInactive: boolean): Promise<{ geofences: GeofenceItem[]; defaults?: { radiusMeters: number } }> {
  const qs = includeInactive ? '?includeInactive=true' : '';
  const res = await fetch(`/api/geofences${qs}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to load geofences');
  return data;
}

// ─── Constants ──────────────────────────────────────────────────────────────
const NAVY = '#1A3C6E';
const DEFAULT_CENTER: [number, number] = [17.4563, 78.6698]; // JNTUH approximate location
const DEFAULT_ZOOM = 16;

// ─── Haversine Distance ─────────────────────────────────────────────────────
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ─── Active Session Type ────────────────────────────────────────────────────
interface ActiveSession {
  id: string;
  sessionDate: string;
  startTime: string;
  captureMethod: string;
  status: string;
  expectedCount: number;
  presentCount: number;
  course: { name: string; code: string };
  creator: { name: string };
  geofence: {
    name: string;
    type?: string;
    centerLat?: number;
    centerLng?: number;
    radiusMtrs?: number;
    polygonData?: string | null;
  } | null;
  timetableSlot: { roomNumber: string | null; building: string | null } | null;
  alreadyMarked: boolean;
  existingRecord?: {
    status: string;
    faceVerified: boolean;
    geofenceValidated: boolean;
  } | null;
}

// ─── Map Component (dynamic import to avoid SSR issues) ─────────────────────
function MapView({
  geofences,
  activeSessions,
  userLocation,
  onGeofenceClick,
  selectedSession,
  mapVisible,
}: {
  geofences: GeofenceItem[];
  activeSessions: ActiveSession[];
  userLocation: { lat: number; lng: number } | null;
  onGeofenceClick: (geofence: GeofenceItem) => void;
  selectedSession: ActiveSession | null;
  mapVisible: boolean;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapReady, setMapReady] = useState(false);
  const leafletMapRef = useRef<any>(null);
  const layersRef = useRef<any[]>([]);
  const mountedRef = useRef(true);

  // Load Leaflet CSS + JS dynamically
  useEffect(() => {
    if (typeof window === 'undefined') return;
    mountedRef.current = true;

    // Add CSS if not already added
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // Load Leaflet JS
    const loadMap = async () => {
      const L = (await import('leaflet')).default;

      if (!mapRef.current || leafletMapRef.current || !mountedRef.current) return;

      const map = L.map(mapRef.current, {
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      leafletMapRef.current = map;
      if (mountedRef.current) setMapReady(true);
    };

    // Small delay to ensure DOM is ready
    const timer = setTimeout(loadMap, 100);
    return () => {
      mountedRef.current = false;
      clearTimeout(timer);
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
      }
      setMapReady(false);
    };
  }, []);

  // Update layers when data changes
  useEffect(() => {
    if (!leafletMapRef.current || !mapReady) return;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const L = require('leaflet');

    // Clear existing layers
    layersRef.current.forEach(layer => layer.remove());
    layersRef.current = [];

    const map = leafletMapRef.current;

    // Draw geofence shapes (active zones only on map)
    geofences.filter((g) => g.isActive).forEach(g => {
      const isActive = activeSessions.some(s => s.geofence?.name === g.name);

      if (g.type === 'polygon' && g.polygonData) {
        const polygon = parsePolygonData(g.polygonData);
        if (polygon) {
          const latlngs = polygon.map((p) => [p.lat, p.lng] as [number, number]);
          const poly = L.polygon(latlngs, {
            color: isActive ? '#16a34a' : NAVY,
            fillColor: isActive ? '#22c55e' : NAVY,
            fillOpacity: isActive ? 0.15 : 0.08,
            weight: isActive ? 3 : 2,
            dashArray: isActive ? undefined : '5 5',
          }).addTo(map);

          poly.bindPopup(`
            <div style="font-size:12px; min-width:160px;">
              <strong style="color:${isActive ? '#16a34a' : NAVY}">${g.name}</strong><br/>
              <span>Type: polygon</span><br/>
              <span>Vertices: ${polygon.length}</span><br/>
              ${g.building ? `<span>Building: ${g.building}</span><br/>` : ''}
              ${isActive ? '<span style="color:#16a34a; font-weight:600;">🔴 Active Session</span>' : '<span style="color:#888;">No active session</span>'}
            </div>
          `);

          poly.on('click', () => onGeofenceClick(g));
          layersRef.current.push(poly);
        }
        return;
      }

      if (g.centerLat != null && g.centerLng != null && g.radiusMtrs) {
        const circle = L.circle([g.centerLat, g.centerLng], {
          radius: g.radiusMtrs,
          color: isActive ? '#16a34a' : NAVY,
          fillColor: isActive ? '#22c55e' : NAVY,
          fillOpacity: isActive ? 0.15 : 0.08,
          weight: isActive ? 3 : 2,
          dashArray: isActive ? null : '5 5',
        }).addTo(map);

        circle.bindPopup(`
          <div style="font-size:12px; min-width:160px;">
            <strong style="color:${isActive ? '#16a34a' : NAVY}">${g.name}</strong><br/>
            <span>Type: ${g.type}</span><br/>
            <span>Radius: ${g.radiusMtrs}m</span><br/>
            ${g.building ? `<span>Building: ${g.building}</span><br/>` : ''}
            ${isActive ? '<span style="color:#16a34a; font-weight:600;">🔴 Active Session</span>' : '<span style="color:#888;">No active session</span>'}
          </div>
        `);

        circle.on('click', () => onGeofenceClick(g));
        layersRef.current.push(circle);

        // Add center marker
        const marker = L.circleMarker([g.centerLat, g.centerLng], {
          radius: 4,
          color: isActive ? '#16a34a' : NAVY,
          fillColor: isActive ? '#22c55e' : NAVY,
          fillOpacity: 1,
          weight: 2,
        }).addTo(map);
        layersRef.current.push(marker);
      }
    });

    // Draw user location
    if (userLocation) {
      const userMarker = L.circleMarker([userLocation.lat, userLocation.lng], {
        radius: 8,
        color: '#0ea5e9',
        fillColor: '#0ea5e9',
        fillOpacity: 0.8,
        weight: 3,
      }).addTo(map);
      userMarker.bindPopup('<div style="font-size:12px;"><strong>Your Location</strong><br/>GPS position acquired</div>');
      layersRef.current.push(userMarker);

      // Accuracy circle
      const accuracyCircle = L.circle([userLocation.lat, userLocation.lng], {
        radius: 30,
        color: '#0ea5e9',
        fillColor: '#0ea5e9',
        fillOpacity: 0.05,
        weight: 1,
      }).addTo(map);
      layersRef.current.push(accuracyCircle);
    }

  }, [mapReady, geofences, activeSessions, userLocation, onGeofenceClick]);

  // Leaflet renders at zero size inside hidden tabs — refresh when tab becomes visible
  useEffect(() => {
    if (!leafletMapRef.current || !mapReady || !mapVisible) return;
    const map = leafletMapRef.current;
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 150);
    return () => clearTimeout(timer);
  }, [mapReady, mapVisible]);

  // Fit map to all active geofences on load
  useEffect(() => {
    if (!leafletMapRef.current || !mapReady || !mapVisible || selectedSession?.geofence) return;
    const L = require('leaflet');
    const active = geofences.filter((g) => g.isActive);
    if (active.length === 0) return;

    const bounds = L.latLngBounds([]);
    active.forEach((g) => {
      if (g.type === 'polygon' && g.polygonData) {
        parsePolygonData(g.polygonData)?.forEach((p) => bounds.extend([p.lat, p.lng]));
      } else if (g.centerLat != null && g.centerLng != null) {
        bounds.extend([g.centerLat, g.centerLng]);
      }
    });
    if (bounds.isValid()) {
      leafletMapRef.current.fitBounds(bounds, { padding: [32, 32], maxZoom: 17 });
    }
  }, [mapReady, mapVisible, geofences, selectedSession]);

  // Fit bounds to selected session's geofence
  useEffect(() => {
    if (!leafletMapRef.current || !mapReady || !selectedSession?.geofence) return;
    const L = require('leaflet');
    const g = selectedSession.geofence;
    if (g.type === 'polygon' && g.polygonData) {
      const polygon = parsePolygonData(g.polygonData);
      if (polygon?.length) {
        const bounds = L.latLngBounds(polygon.map((p) => [p.lat, p.lng]));
        leafletMapRef.current.fitBounds(bounds, { padding: [24, 24], animate: true });
      }
    } else if (g.centerLat != null && g.centerLng != null) {
      leafletMapRef.current.setView([g.centerLat, g.centerLng], DEFAULT_ZOOM + 2, { animate: true });
    }
  }, [mapReady, selectedSession]);

  return (
    <div className="relative">
      <div ref={mapRef} className="w-full h-[400px] md:h-[500px] rounded-lg z-0" />
      {!mapReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/30 rounded-lg">
          <Loader2 className="h-6 w-6 animate-spin text-[#1A3C6E]" />
        </div>
      )}
      {userLocation && (
        <div className="absolute top-2 right-2 bg-background/90 backdrop-blur rounded-md px-2 py-1 text-[10px] flex items-center gap-1 shadow-sm z-10">
          <Crosshair className="h-3 w-3 text-sky-500" />
          <span>{userLocation.lat.toFixed(5)}, {userLocation.lng.toFixed(5)}</span>
        </div>
      )}
    </div>
  );
}

// ─── Student Mark Attendance Panel ──────────────────────────────────────────
function StudentMarkPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentUser } = useAppStore();
  const [selectedSession, setSelectedSession] = useState<ActiveSession | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [geofenceStatus, setGeofenceStatus] = useState<GeofenceCheckResult | null>(null);

  // Fetch active sessions
  const { data: activeData, isLoading: activeLoading } = useQuery({
    queryKey: ['active-sessions-map', currentUser?.id],
    queryFn: () => fetch(`/api/attendance/active-sessions?studentId=${currentUser!.id}`).then(r => r.json()),
    enabled: !!currentUser,
    refetchInterval: 15000,
  });

  const requestLocation = useCallback((sessionOverride?: ActiveSession | null) => {
    const session = sessionOverride ?? selectedSession;
    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        setLocationError(null);

        if (session?.geofence) {
          setGeofenceStatus(checkLocationAgainstSessionGeofence(session.geofence, loc.lat, loc.lng));
        } else {
          setGeofenceStatus(null);
        }
      },
      (err) => setLocationError(err.message),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [selectedSession]);

  useEffect(() => {
    if (!userLocation || !selectedSession?.geofence) return;
    setGeofenceStatus(
      checkLocationAgainstSessionGeofence(selectedSession.geofence, userLocation.lat, userLocation.lng),
    );
  }, [selectedSession, userLocation]);

  // Mark attendance mutation
  const markMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch('/api/attendance/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async r => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Failed to mark attendance');
        return data;
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['active-sessions-map'] });
      queryClient.invalidateQueries({ queryKey: ['geofences'] });
      toast({
        title: 'Attendance Marked!',
        description: `Geo: ${data.geofenceValidated ? '✅' : '❌'} | ${data.geofenceValidated ? `Within ${Math.round(data.distanceFromCenter)}m` : 'Out of bounds'}`,
        variant: data.geofenceValidated ? 'default' : 'destructive',
      });
      setSelectedSession(null);
      setGeofenceStatus(null);
    },
    onError: (err) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  if (!currentUser) return null;

  const activeSessions: ActiveSession[] = activeData?.sessions ?? [];
  const geoRequiredForSession = (session: ActiveSession) =>
    captureMethodRequiresGeofence(session.captureMethod);

  const handleMarkAttendance = () => {
    if (!selectedSession || !userLocation) return;
    markMutation.mutate({
      sessionId: selectedSession.id,
      studentId: currentUser.id,
      latitude: userLocation.lat,
      longitude: userLocation.lng,
      captureMethod: 'self_geo_face',
    });
  };

  return (
    <Card className="border-l-4" style={{ borderLeftColor: NAVY }}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Navigation className="h-4 w-4" />
          Mark Attendance from Map
        </CardTitle>
        <CardDescription>Select an active session, verify your location, and mark attendance</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Session Selector */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Active Sessions</Label>
          {activeLoading ? (
            <div className="space-y-2">
              {[1, 2].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : activeSessions.length === 0 ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">No active sessions right now</span>
            </div>
          ) : (
            <ScrollArea className="max-h-48">
              <div className="space-y-2">
                {activeSessions.map(session => (
                  <button
                    key={session.id}
                    onClick={() => {
                      setSelectedSession(session);
                      setUserLocation(null);
                      setGeofenceStatus(null);
                      setLocationError(null);
                      requestLocation(session);
                    }}
                    className={cn(
                      'w-full text-left p-3 rounded-lg border transition-all hover:shadow-sm',
                      session.alreadyMarked ? 'opacity-50 cursor-not-allowed bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800' :
                      selectedSession?.id === session.id ? 'ring-2 ring-[#1A3C6E] bg-[#1A3C6E]/5 border-[#1A3C6E]' : 'hover:border-[#1A3C6E]/30'
                    )}
                    disabled={session.alreadyMarked}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge className="font-mono text-[10px] shrink-0" style={{ backgroundColor: NAVY, color: '#fff' }}>
                          {session.course?.code || 'N/A'}
                        </Badge>
                        <span className="text-sm font-medium truncate">{session.course?.name}</span>
                      </div>
                      {session.alreadyMarked ? (
                        <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200 shrink-0">
                          <CheckCircle2 className="h-3 w-3 mr-0.5" /> Marked
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200 shrink-0">
                          Live
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{session.startTime}</span>
                      {session.geofence && (
                        <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{session.geofence.name}</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Location + Geofence Status */}
        {selectedSession && (
          <div className="space-y-3 pt-2 border-t">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <Navigation className="h-3.5 w-3.5" /> Location & Geofence Status
            </Label>

            {userLocation ? (
              <div className={cn(
                'p-3 rounded-lg border',
                !selectedSession.geofence
                  ? 'bg-muted/50 border-border'
                  : geofenceStatus?.inside
                    ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                    : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
              )}>
                <div className="flex items-center gap-2 mb-2">
                  {!selectedSession.geofence ? (
                    <MapPin className="h-5 w-5 text-muted-foreground" />
                  ) : geofenceStatus?.inside ? (
                    <ShieldCheck className="h-5 w-5 text-green-600" />
                  ) : (
                    <ShieldAlert className="h-5 w-5 text-red-600" />
                  )}
                  <div>
                    <p className="text-sm font-semibold">
                      {!selectedSession.geofence
                        ? 'No geofence on this session'
                        : geofenceStatus?.inside ? '✅ Inside Geofence' : '❌ Outside Geofence'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {geofenceStatus ? geofenceStatusLabel(geofenceStatus) : selectedSession.geofence ? 'Checking...' : 'Location captured for audit'}
                    </p>
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  GPS: {userLocation.lat.toFixed(6)}, {userLocation.lng.toFixed(6)}
                </div>
              </div>
            ) : locationError ? (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-red-600" />
                  <p className="text-xs text-red-700 dark:text-red-400">{locationError}</p>
                </div>
                <Button variant="outline" size="sm" className="mt-2 text-xs h-7" onClick={() => requestLocation()}>
                  Retry Location
                </Button>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 text-amber-600 animate-spin" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">Acquiring location...</p>
                </div>
              </div>
            )}

            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => requestLocation()}>
              <Crosshair className="h-3 w-3 mr-1" /> Refresh Location
            </Button>

            {/* Mark Button */}
            <div className="pt-2 border-t">
              <Button
                className="w-full bg-[#1A3C6E] hover:bg-[#1A3C6E]/90 text-white gap-2"
                disabled={
                  markMutation.isPending ||
                  !userLocation ||
                  (selectedSession.geofence
                    ? !geofenceStatus?.inside
                    : geoRequiredForSession(selectedSession))
                }
                onClick={handleMarkAttendance}
              >
                {markMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Verifying...</>
                ) : (
                  <><UserCheck className="h-4 w-4" /> Mark Attendance</>
                )}
              </Button>
              {!userLocation && (
                <p className="text-[10px] text-amber-600 mt-1 text-center">⚠️ Location required</p>
              )}
              {userLocation && selectedSession.geofence && geofenceStatus && !geofenceStatus.inside && (
                <p className="text-[10px] text-red-600 mt-1 text-center">
                  ❌ {geofenceStatusLabel(geofenceStatus)}
                </p>
              )}
              {userLocation && !selectedSession.geofence && geoRequiredForSession(selectedSession) && (
                <p className="text-[10px] text-red-600 mt-1 text-center">
                  This session requires a geofence — contact faculty.
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Geofences Section ────────────────────────────────────────────────
export default function GeofencesSection() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { currentUser } = useAppStore();
  const [showCreate, setShowCreate] = useState(false);
  const [newFence, setNewFence] = useState({ name: '', type: 'circle', centerLat: '17.4563', centerLng: '78.6698', radiusMtrs: '200', building: '', floor: '' });
  const [editTarget, setEditTarget] = useState<GeofenceItem | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', centerLat: '', centerLng: '', radiusMtrs: '' });
  const [deleteTarget, setDeleteTarget] = useState<GeofenceItem | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [activeTab, setActiveTab] = useState('map');

  const effectiveSections = useEffectiveSections();
  const isStudent = currentUser?.role === 'student';
  const canManageGeofences = currentUser
    ? effectiveSections.includes('geofences') && GEOFENCE_WRITE_ROLES.includes(currentUser.role)
    : false;

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['geofences', canManageGeofences],
    queryFn: () => fetchGeofences(canManageGeofences),
    enabled: !!currentUser,
  });
  const defaultRadius = String(data?.defaults?.radiusMeters ?? 100);
  const activeSessionsQuery = isStudent && currentUser ? `?studentId=${currentUser.id}` : '';

  const { data: activeSessionsData } = useQuery({
    queryKey: ['active-sessions-geofence', currentUser?.id, isStudent],
    queryFn: () => fetch(`/api/attendance/active-sessions${activeSessionsQuery}`).then(r => r.json()),
    enabled: !!currentUser,
    refetchInterval: 15000,
  });

  const activeSessions: ActiveSession[] = activeSessionsData?.sessions ?? [];

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch('/api/geofences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to create geofence');
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['geofences'] });
      setShowCreate(false);
      setNewFence({ name: '', type: 'circle', centerLat: '17.4563', centerLng: '78.6698', radiusMtrs: defaultRadius, building: '', floor: '' });
      toast({ title: 'Geofence Created', description: 'New geofence boundary has been added.' });
    },
    onError: (err) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/geofences/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update geofence');
      return json;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['geofences'] });
      setEditTarget(null);
      toast({ title: 'Geofence Updated', description: 'Changes saved successfully.' });
    },
    onError: (err) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/geofences/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update geofence status');
      return json;
    },
    onSuccess: (_, { isActive }) => {
      qc.invalidateQueries({ queryKey: ['geofences'] });
      toast({
        title: isActive ? 'Geofence Activated' : 'Geofence Deactivated',
        description: `Geofence is now ${isActive ? 'active' : 'inactive'}.`,
      });
    },
    onError: (err) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/geofences/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to delete geofence');
      return json;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['geofences'] });
      setDeleteTarget(null);
      toast({ title: 'Geofence Removed', description: data.message || 'Geofence deleted.' });
    },
    onError: (err) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const openEditDialog = (g: GeofenceItem) => {
    setEditTarget(g);
    setEditForm({
      name: g.name,
      description: '',
      centerLat: g.centerLat != null ? String(g.centerLat) : '',
      centerLng: g.centerLng != null ? String(g.centerLng) : '',
      radiusMtrs: g.radiusMtrs != null ? String(g.radiusMtrs) : '',
    });
  };

  const listColSpan = canManageGeofences ? 8 : 7;

  const geofences = data?.geofences || [];
  const activeCount = geofences.filter(g => g.isActive).length;
  const circleCount = geofences.filter(g => g.type === 'circle').length;
  const polygonCount = geofences.filter(g => g.type === 'polygon').length;

  // Get user location for map
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {}, // silently fail
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  const handleGeofenceClick = useCallback((g: GeofenceItem) => {
    toast({
      title: g.name,
      description: `${g.type} • ${g.radiusMtrs ? g.radiusMtrs + 'm radius' : 'No radius set'} • ${g.building || 'No building'}`,
    });
  }, [toast]);

  if (!currentUser) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1A3C6E]">Geofence Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isStudent ? 'View geofence boundaries & mark attendance from map' : canManageGeofences ? 'Manage GPS geofence boundaries for attendance capture' : 'View campus geofence boundaries'}
          </p>
        </div>
        {canManageGeofences && (
          <Button className="gap-2 bg-[#1A3C6E] hover:bg-[#1A3C6E]/90" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> New Geofence
          </Button>
        )}
      </div>

      {isError && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-4 flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Failed to load geofences: {(error as Error)?.message || 'Unknown error'}
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card className="py-3">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[#1A3C6E]/10 flex items-center justify-center shrink-0"><MapPin className="h-4 w-4 text-[#1A3C6E]" /></div>
            <div><p className="text-[10px] text-muted-foreground">Total Geofences</p><p className="text-lg font-bold">{geofences.length}</p></div>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0"><ToggleRight className="h-4 w-4 text-green-600" /></div>
            <div><p className="text-[10px] text-muted-foreground">Active</p><p className="text-lg font-bold">{activeCount}</p></div>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0"><Circle className="h-4 w-4 text-amber-600" /></div>
            <div><p className="text-[10px] text-muted-foreground">Circle Type</p><p className="text-lg font-bold">{circleCount}</p></div>
          </CardContent>
        </Card>
        <Card className="py-3">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center shrink-0"><Pentagon className="h-4 w-4 text-purple-600" /></div>
            <div><p className="text-[10px] text-muted-foreground">Polygon Type</p><p className="text-lg font-bold">{polygonCount}</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content - Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="map" className="gap-1.5 text-xs">
            <MapPin className="h-3.5 w-3.5" /> Map View
          </TabsTrigger>
          <TabsTrigger value="list" className="gap-1.5 text-xs">
            <Building2 className="h-3.5 w-3.5" /> List View
          </TabsTrigger>
        </TabsList>

        {/* Map Tab */}
        <TabsContent value="map" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Map */}
            <Card className="lg:col-span-2 overflow-hidden">
              <CardContent className="p-0">
                <MapView
                  geofences={geofences}
                  activeSessions={activeSessions}
                  userLocation={userLocation}
                  onGeofenceClick={handleGeofenceClick}
                  selectedSession={null}
                  mapVisible={activeTab === 'map'}
                />
              </CardContent>
            </Card>

            {/* Right Panel: Student mark or Geofence details */}
            <div className="space-y-4">
              {isStudent ? (
                <StudentMarkPanel />
              ) : (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Geofence Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="max-h-[400px]">
                      <div className="space-y-3">
                        {geofences.map(g => {
                          const hasActive = activeSessions.some(s => s.geofence?.name === g.name);
                          return (
                            <div
                              key={g.id}
                              className={cn(
                                'p-3 rounded-lg border transition-colors',
                                hasActive ? 'border-green-200 bg-green-50/50 dark:bg-green-900/10 dark:border-green-800' : 'hover:bg-muted/30'
                              )}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className={cn(
                                    'h-3 w-3 rounded-full shrink-0',
                                    g.isActive ? (hasActive ? 'bg-green-500' : 'bg-[#1A3C6E]') : 'bg-gray-400'
                                  )} />
                                  <span className="text-sm font-medium truncate">{g.name}</span>
                                </div>
                                {hasActive && (
                                  <Badge className="text-[9px] bg-green-100 text-green-700 border-green-200 shrink-0">
                                    Live
                                  </Badge>
                                )}
                              </div>
                              <div className="mt-1.5 text-xs text-muted-foreground space-y-0.5">
                                {g.type === 'polygon' ? (
                                  <p>Polygon boundary{g.building ? ` • ${g.building}` : ''}</p>
                                ) : (
                                  <>
                                    {g.centerLat != null && g.centerLng != null && (
                                      <p>{g.centerLat.toFixed(4)}, {g.centerLng.toFixed(4)}</p>
                                    )}
                                    {g.radiusMtrs && <p>Radius: {g.radiusMtrs}m</p>}
                                    {g.building && <p>Building: {g.building}</p>}
                                  </>
                                )}
                              </div>
                              {hasActive && (
                                <div className="mt-2 pt-2 border-t border-green-200 dark:border-green-800">
                                  {activeSessions
                                    .filter(s => s.geofence?.name === g.name)
                                    .map(s => (
                                      <div key={s.id} className="flex items-center gap-2 text-xs">
                                        <Badge className="font-mono text-[9px]" style={{ backgroundColor: NAVY, color: '#fff' }}>
                                          {s.course?.code}
                                        </Badge>
                                        <span className="truncate">{s.course?.name}</span>
                                        <span className="ml-auto text-muted-foreground">{s.presentCount}/{s.expectedCount}</span>
                                      </div>
                                    ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* List Tab */}
        <TabsContent value="list">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">All Geofences</CardTitle>
              <CardDescription>Manage geofence boundaries for attendance sessions</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Name</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs">Coordinates</TableHead>
                      <TableHead className="text-xs">Building</TableHead>
                      <TableHead className="text-xs">Radius</TableHead>
                      <TableHead className="text-xs">Sessions</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      {canManageGeofences && <TableHead className="text-xs text-right">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRow><TableCell colSpan={listColSpan} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                    ) : geofences.length === 0 ? (
                      <TableRow><TableCell colSpan={listColSpan} className="text-center py-8 text-muted-foreground">No geofences found</TableCell></TableRow>
                    ) : (
                      geofences.map(g => (
                        <TableRow key={g.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-[#1A3C6E]" />
                              <span className="font-medium text-sm">{g.name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="gap-1 text-xs">
                              {g.type === 'circle' ? <Circle className="h-3 w-3" /> : <Pentagon className="h-3 w-3" />}
                              {g.type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground">
                            {g.type === 'polygon'
                              ? `${parsePolygonData(g.polygonData)?.length ?? 0} vertices`
                              : g.centerLat != null
                                ? `${g.centerLat.toFixed(4)}, ${g.centerLng?.toFixed(4)}`
                                : '-'}
                          </TableCell>
                          <TableCell className="text-sm">{g.building || '-'}</TableCell>
                          <TableCell className="text-sm">{g.radiusMtrs ? `${g.radiusMtrs}m` : '-'}</TableCell>
                          <TableCell className="text-sm">{g._count.attendanceSessions}</TableCell>
                          <TableCell>
                            <Badge className={g.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'} variant="secondary">
                              {g.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          {canManageGeofences && (
                            <TableCell>
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  title={g.isActive ? 'Deactivate' : 'Activate'}
                                  disabled={toggleActiveMutation.isPending}
                                  onClick={() => toggleActiveMutation.mutate({ id: g.id, isActive: !g.isActive })}
                                >
                                  {g.isActive ? (
                                    <ToggleRight className="h-3.5 w-3.5 text-green-600" />
                                  ) : (
                                    <ToggleLeft className="h-3.5 w-3.5 text-muted-foreground" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  title={g.type === 'circle' ? 'Edit geofence' : 'Only circle geofences can be edited'}
                                  disabled={g.type !== 'circle'}
                                  onClick={() => openEditDialog(g)}
                                >
                                  <Pencil className={cn('h-3.5 w-3.5', g.type !== 'circle' && 'opacity-40')} />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  title="Delete geofence"
                                  onClick={() => setDeleteTarget(g)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Geofence Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#1A3C6E]">Create New Geofence</DialogTitle>
            <DialogDescription>Define a geofence boundary for attendance capture</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={newFence.name} onChange={e => setNewFence(p => ({ ...p, name: e.target.value }))} placeholder="e.g., New Science Block" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Center Latitude</Label><Input value={newFence.centerLat} onChange={e => setNewFence(p => ({ ...p, centerLat: e.target.value }))} /></div>
              <div><Label>Center Longitude</Label><Input value={newFence.centerLng} onChange={e => setNewFence(p => ({ ...p, centerLng: e.target.value }))} /></div>
            </div>
            <div><Label>Radius (meters)</Label><Input value={newFence.radiusMtrs} onChange={e => setNewFence(p => ({ ...p, radiusMtrs: e.target.value }))} /></div>
            <div><Label>Building</Label><Input value={newFence.building} onChange={e => setNewFence(p => ({ ...p, building: e.target.value }))} placeholder="e.g., CSE Building" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button className="bg-[#1A3C6E] hover:bg-[#1A3C6E]/90" onClick={() => createMutation.mutate({
              name: newFence.name, type: 'circle',
              centerLat: parseFloat(newFence.centerLat), centerLng: parseFloat(newFence.centerLng),
              radiusMtrs: parseFloat(newFence.radiusMtrs), building: newFence.building, isActive: true,
            })} disabled={!newFence.name || createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Create Geofence
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Geofence Dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#1A3C6E]">Edit Geofence</DialogTitle>
            <DialogDescription>Update circle geofence boundary details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} /></div>
            <div>
              <Label>Description</Label>
              <Textarea
                rows={2}
                value={editForm.description}
                onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Optional notes about this boundary"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Center Latitude</Label><Input value={editForm.centerLat} onChange={e => setEditForm(p => ({ ...p, centerLat: e.target.value }))} /></div>
              <div><Label>Center Longitude</Label><Input value={editForm.centerLng} onChange={e => setEditForm(p => ({ ...p, centerLng: e.target.value }))} /></div>
            </div>
            <div><Label>Radius (meters)</Label><Input value={editForm.radiusMtrs} onChange={e => setEditForm(p => ({ ...p, radiusMtrs: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button
              className="bg-[#1A3C6E] hover:bg-[#1A3C6E]/90"
              disabled={!editForm.name || !editTarget || updateMutation.isPending}
              onClick={() => {
                if (!editTarget) return;
                const payload: Record<string, unknown> = {
                  name: editForm.name,
                  centerLat: parseFloat(editForm.centerLat),
                  centerLng: parseFloat(editForm.centerLng),
                  radiusMtrs: parseFloat(editForm.radiusMtrs),
                };
                if (editForm.description.trim()) payload.description = editForm.description.trim();
                updateMutation.mutate({ id: editTarget.id, data: payload });
              }}
            >
              {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Geofence Confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteTarget && deleteTarget._count.attendanceSessions > 0 ? 'Deactivate geofence?' : 'Delete geofence?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget && deleteTarget._count.attendanceSessions > 0
                ? `"${deleteTarget.name}" has ${deleteTarget._count.attendanceSessions} linked attendance session(s) and will be deactivated instead of deleted.`
                : `This will permanently remove "${deleteTarget?.name}". This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
              }}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {deleteTarget && deleteTarget._count.attendanceSessions > 0 ? 'Deactivate' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
