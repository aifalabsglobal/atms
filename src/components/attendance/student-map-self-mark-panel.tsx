'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  MapPin, Navigation, CheckCircle2, Clock, ShieldCheck, ShieldAlert,
  Loader2, Crosshair, UserCheck, Camera, Upload, Video,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAppStore } from '@/lib/store';
import {
  sessionNeedsGeofence,
  shouldEnforceGeofence,
  checkLocationAgainstSessionGeofence,
  geofenceStatusLabel,
  type GeofenceCheckResult,
} from '@/lib/geofence-policy';
import { useOrgSettings } from '@/hooks/use-org-settings';
import { DEFAULT_ORG_SETTINGS } from '@/lib/settings/org-defaults';
import { cn } from '@/lib/utils';
import { DEFAULT_BRAND_PRIMARY } from '@/lib/brand-color';

const NAVY = DEFAULT_BRAND_PRIMARY;

export type MapActiveSession = {
  id: string;
  sessionDate: string;
  startTime: string;
  captureMethod: string;
  status: string;
  expectedCount: number;
  presentCount: number;
  geofenceId?: string | null;
  course: { name: string; code: string };
  creator: { name: string };
  geofence: {
    id?: string;
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
};

/** Compact self-mark panel for Geofences map (parity with Attendance tab: geo + face). */
export function StudentMapSelfMarkPanel({
  onSelectedSessionChange,
}: {
  onSelectedSessionChange?: (session: MapActiveSession | null) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentUser } = useAppStore();
  const { data: orgSettings } = useOrgSettings();
  const org = orgSettings ?? DEFAULT_ORG_SETTINGS;
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedSession, setSelectedSession] = useState<MapActiveSession | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [geofenceStatus, setGeofenceStatus] = useState<GeofenceCheckResult | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [selfieBase64, setSelfieBase64] = useState<string | null>(null);

  const selectSession = useCallback(
    (session: MapActiveSession | null) => {
      setSelectedSession(session);
      onSelectedSessionChange?.(session);
    },
    [onSelectedSessionChange],
  );

  const { data: activeData, isLoading: activeLoading } = useQuery({
    queryKey: ['active-sessions-map', currentUser?.id],
    queryFn: () => fetch(`/api/attendance/active-sessions?studentId=${currentUser!.id}`).then((r) => r.json()),
    enabled: !!currentUser,
    refetchInterval: 15000,
  });

  const faceVerificationMode = (activeData?.faceVerificationMode ?? 'disabled') as 'live' | 'demo' | 'disabled';
  const faceVerificationEnforced = activeData?.faceVerificationEnforced === true;
  const faceVerificationConfigured = activeData?.faceVerificationConfigured === true;
  const geofenceSelfMarkRequired = activeData?.geofenceSelfMarkRequired === true;
  const selfieRequired = faceVerificationEnforced && faceVerificationConfigured;
  const faceMisconfigured = faceVerificationEnforced && !faceVerificationConfigured;

  const requestLocation = useCallback(
    (sessionOverride?: MapActiveSession | null) => {
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
        { enableHighAccuracy: true, timeout: 10000 },
      );
    },
    [selectedSession],
  );

  useEffect(() => {
    if (!userLocation || !selectedSession?.geofence) return;
    setGeofenceStatus(
      checkLocationAgainstSessionGeofence(selectedSession.geofence, userLocation.lat, userLocation.lng),
    );
  }, [selectedSession, userLocation]);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 480, height: 480 },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch {
      toast({ title: 'Camera Error', description: 'Could not access camera', variant: 'destructive' });
    }
  }, [toast]);

  const captureSelfie = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = 480;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, 480, 480);
    setSelfieBase64(canvas.toDataURL('image/png'));
    const stream = video.srcObject as MediaStream;
    stream?.getTracks().forEach((t) => t.stop());
    setCameraActive(false);
  }, []);

  const markMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch('/api/attendance/mark', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Failed to mark attendance');
        return data;
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['active-sessions-map'] });
      queryClient.invalidateQueries({ queryKey: ['active-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['geofences'] });
      queryClient.invalidateQueries({ queryKey: ['geofence-live-activity'] });
      const distLabel =
        data.distanceFromCenter != null && Number.isFinite(data.distanceFromCenter)
          ? `Within ${Math.round(data.distanceFromCenter)}m`
          : data.geofenceValidated
            ? 'Inside zone'
            : 'Checked';
      toast({
        title: 'Attendance Marked!',
        description: `Geo: ${data.geofenceValidated ? '✅' : '⚠️'} ${distLabel} | Face: ${data.faceVerified ? '✅' : faceVerificationMode === 'live' ? '❌' : 'skipped'}`,
      });
      selectSession(null);
      setGeofenceStatus(null);
      setSelfieBase64(null);
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  if (!currentUser) return null;

  const activeSessions: MapActiveSession[] = activeData?.sessions ?? [];
  const geoRequiredForSession = (session: MapActiveSession) =>
    shouldEnforceGeofence(
      geofenceSelfMarkRequired,
      sessionNeedsGeofence({
        hasGeofence: !!session.geofence,
        sessionCaptureMethod: session.captureMethod,
        markMethod: 'self_geo_face',
      }),
    );

  const handleMarkAttendance = () => {
    if (!selectedSession) return;
    const needsGeo = geoRequiredForSession(selectedSession);
    if (needsGeo && !userLocation) return;
    if (needsGeo && !selectedSession.geofence) {
      toast({ title: 'Geofence required', description: 'This session requires a geofence — contact faculty.', variant: 'destructive' });
      return;
    }
    if (needsGeo && geofenceStatus?.requiresGeofence && !geofenceStatus.inside) {
      toast({ title: 'Outside geofence', description: geofenceStatusLabel(geofenceStatus), variant: 'destructive' });
      return;
    }
    if (selfieRequired && !selfieBase64) {
      toast({ title: 'Selfie required', description: 'Face verification is enforced — capture a selfie before marking.', variant: 'destructive' });
      return;
    }
    if (faceMisconfigured) {
      toast({
        title: 'Face verification unavailable',
        description: 'Contact an administrator — enforcement is on but the verification API is not configured.',
        variant: 'destructive',
      });
      return;
    }
    markMutation.mutate({
      sessionId: selectedSession.id,
      studentId: currentUser.id,
      latitude: userLocation?.lat,
      longitude: userLocation?.lng,
      selfieBase64,
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
        <CardDescription>Select a session, verify location and selfie, then mark</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {faceMisconfigured && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-[11px] text-red-800">
            Face verification is enforced but the API is not configured. Marking is blocked.
          </div>
        )}
        {(org.holidayBlockAttendance || org.enforceDayHours) && (
          <div className="rounded-lg border border-sky-200 bg-sky-50 p-2.5 text-[11px] text-sky-900">
            Self-mark follows campus Organization rules
            {org.enforceDayHours ? ` · hours ${org.dayStartTime}–${org.dayEndTime}` : ''}
            {org.holidayBlockAttendance ? ' · holidays/exam days may block' : ''}.
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-xs font-semibold">Active Sessions</Label>
          {activeLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : activeSessions.length === 0 ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">No active sessions right now</span>
            </div>
          ) : (
            <ScrollArea className="max-h-48">
              <div className="space-y-2">
                {activeSessions.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => {
                      if (session.alreadyMarked) return;
                      selectSession(session);
                      setUserLocation(null);
                      setGeofenceStatus(null);
                      setLocationError(null);
                      setSelfieBase64(null);
                      requestLocation(session);
                    }}
                    className={cn(
                      'w-full text-left p-3 rounded-lg border transition-all hover:shadow-sm',
                      session.alreadyMarked
                        ? 'opacity-50 cursor-not-allowed bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                        : selectedSession?.id === session.id
                          ? 'ring-2 ring-brand bg-brand/5 border-brand'
                          : 'hover:border-brand/30',
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
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {session.startTime}
                      </span>
                      {session.geofence && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {session.geofence.name}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {selectedSession && (
          <div className="space-y-3 pt-2 border-t">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <Navigation className="h-3.5 w-3.5" /> Location & Geofence
            </Label>

            {userLocation ? (
              <div
                className={cn(
                  'p-3 rounded-lg border',
                  !selectedSession.geofence
                    ? 'bg-muted/50 border-border'
                    : geofenceStatus?.inside
                      ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                      : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800',
                )}
              >
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
                        : geofenceStatus?.inside
                          ? 'Inside Geofence'
                          : 'Outside Geofence'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {geofenceStatus
                        ? geofenceStatusLabel(geofenceStatus)
                        : selectedSession.geofence
                          ? 'Checking...'
                          : 'Location captured for audit'}
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

            <div className="space-y-2">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Camera className="h-3.5 w-3.5" /> Selfie {selfieRequired ? '(Required)' : '(Optional)'}
              </Label>
              {selfieBase64 ? (
                <div className="flex items-center gap-3">
                  <div className="h-14 w-14 rounded-full overflow-hidden border-2 border-green-400">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={selfieBase64} alt="Selfie" className="h-full w-full object-cover" />
                  </div>
                  <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => setSelfieBase64(null)}>
                    Retake
                  </Button>
                </div>
              ) : cameraActive ? (
                <div className="space-y-2">
                  <div className="relative w-36 h-36 mx-auto rounded-full overflow-hidden border-2 border-brand/30">
                    <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover scale-x-[-1]" />
                  </div>
                  <Button onClick={captureSelfie} size="sm" className="w-full bg-brand hover:bg-brand/90 text-white">
                    <Camera className="h-3.5 w-3.5 mr-1" /> Capture
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={startCamera}>
                    <Video className="h-3 w-3" /> Camera
                  </Button>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = (ev) => setSelfieBase64(ev.target?.result as string);
                        reader.readAsDataURL(file);
                      }}
                    />
                    <Button variant="outline" size="sm" className="text-xs h-7 gap-1" asChild>
                      <span>
                        <Upload className="h-3 w-3" /> Upload
                      </span>
                    </Button>
                  </label>
                </div>
              )}
              <canvas ref={canvasRef} className="hidden" />
            </div>

            <div className="pt-2 border-t">
              <Button
                className="w-full bg-brand hover:bg-brand/90 text-white gap-2"
                disabled={
                  markMutation.isPending ||
                  faceMisconfigured ||
                  (selfieRequired && !selfieBase64) ||
                  (geoRequiredForSession(selectedSession) &&
                    (!userLocation ||
                      !selectedSession.geofence ||
                      (!!geofenceStatus?.requiresGeofence && !geofenceStatus.inside)))
                }
                onClick={handleMarkAttendance}
              >
                {markMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Verifying...
                  </>
                ) : (
                  <>
                    <UserCheck className="h-4 w-4" /> Mark Attendance
                  </>
                )}
              </Button>
              {geoRequiredForSession(selectedSession) && !userLocation && (
                <p className="text-[10px] text-amber-600 mt-1 text-center">Location required</p>
              )}
              {selfieRequired && !selfieBase64 && (
                <p className="text-[10px] text-amber-600 mt-1 text-center">Selfie required for face verification</p>
              )}
              {geoRequiredForSession(selectedSession) && !selectedSession.geofence && (
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
