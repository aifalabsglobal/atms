'use client';

import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  ScanLine, Plus, PenLine, ScanFace, MapPin, QrCode,
  Fingerprint, Radio, CalendarIcon, ChevronLeft, ChevronRight,
  MoreHorizontal, Eye, Trash2, Clock, Users, CheckCircle2,
  XCircle, AlertTriangle, Loader2, Search, Camera, Navigation,
  ShieldCheck, ShieldAlert, UserCheck, Upload, Video, Pencil,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { useAppStore, useCanManageTimetable } from '@/lib/store';
import {
  captureMethodRequiresGeofence,
  suggestGeofenceForBuilding,
  checkLocationAgainstSessionGeofence,
  geofenceStatusLabel,
  type GeofenceCheckResult,
} from '@/lib/geofence-policy';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';

// ─── Types ──────────────────────────────────────────────────────
interface CourseOption { id: string; name: string; code: string }
interface GeofenceOption { id: string; name: string; building?: string | null; isActive?: boolean }

interface AttendanceSession {
  id: string;
  sessionDate: string;
  startTime: string;
  endTime: string | null;
  captureMethod: string;
  status: string;
  expectedCount: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  courseId: string;
  createdBy: string;
  geofenceId: string | null;
  timetableSlotId: string | null;
  course: { name: string; code: string };
  creator: { name: string };
  geofence: { name: string; type?: string; centerLat?: number; centerLng?: number; radiusMtrs?: number; polygonData?: string | null } | null;
  timetableSlot: { roomNumber: string | null; building: string | null; startTime: string; endTime: string } | null;
  _count: { records: number };
}

interface ActiveSession {
  id: string;
  sessionDate: string;
  startTime: string;
  endTime: string | null;
  captureMethod: string;
  status: string;
  expectedCount: number;
  presentCount: number;
  course: { name: string; code: string };
  creator: { name: string };
  geofence: { name: string; type?: string; centerLat?: number; centerLng?: number; radiusMtrs?: number; polygonData?: string | null } | null;
  timetableSlot: { roomNumber: string | null; building: string | null } | null;
  alreadyMarked: boolean;
  existingRecord?: {
    status: string;
    faceVerified: boolean;
    geofenceValidated: boolean;
    selfieUrl?: string | null;
    gpsLat?: number | null;
    gpsLng?: number | null;
    confidence?: number | null;
    distanceFromCenter?: number | null;
    captureMethod: string;
  } | null;
}

interface SessionsResponse {
  sessions: AttendanceSession[];
  total: number;
  page: number;
  limit: number;
  summary: {
    totalSessions: number;
    activeCount: number;
    completedCount: number;
    avgAttendanceRate: number;
  };
}

// ─── Constants ──────────────────────────────────────────────────
const UOH_NAVY = '#1A3C6E';

const CAPTURE_METHOD_CONFIG: Record<string, { icon: React.ElementType; label: string }> = {
  manual: { icon: PenLine, label: 'Manual' },
  face: { icon: ScanFace, label: 'Face' },
  gps: { icon: MapPin, label: 'GPS' },
  qrcode: { icon: QrCode, label: 'QR Code' },
  biometric: { icon: Fingerprint, label: 'Biometric' },
  beacon: { icon: Radio, label: 'Beacon' },
  self_geo_face: { icon: ScanFace, label: 'Geo+Face' },
};

const STATUS_CONFIG: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string; label: string }> = {
  upcoming: { variant: 'secondary', className: '', label: 'Upcoming' },
  active: { variant: 'default', className: 'bg-green-600 hover:bg-green-600 text-white', label: 'Active' },
  completed: { variant: 'default', className: '', label: 'Completed' },
  cancelled: { variant: 'destructive', className: '', label: 'Cancelled' },
};

// ─── Helper ─────────────────────────────────────────────────────
function getAttendanceColor(rate: number) {
  if (rate >= 75) return 'text-green-600';
  if (rate >= 65) return 'text-amber-600';
  return 'text-red-600';
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

// ─── Student Self-Marking Component ─────────────────────────────
function StudentMarkAttendance() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { currentUser } = useAppStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedSession, setSelectedSession] = useState<ActiveSession | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [selfieBase64, setSelfieBase64] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [geofenceCheck, setGeofenceCheck] = useState<GeofenceCheckResult | null>(null);
  const [markingStep, setMarkingStep] = useState<'select' | 'location' | 'camera' | 'submitting' | 'done'>('select');

  // Fetch active sessions for student
  const { data: activeData, isLoading: activeLoading } = useQuery({
    queryKey: ['active-sessions', currentUser?.id],
    queryFn: () => fetch(`/api/attendance/active-sessions?studentId=${currentUser!.id}`).then(r => r.json()),
    enabled: !!currentUser,
    refetchInterval: 30_000,
    staleTime: 20_000,
  });

  const activeSessions: ActiveSession[] = activeData?.sessions ?? [];
  const faceVerificationMode = (activeData?.faceVerificationMode ?? 'disabled') as 'live' | 'demo' | 'disabled';
  const faceVerificationEnforced = activeData?.faceVerificationEnforced === true;
  const faceVerificationConfigured = activeData?.faceVerificationConfigured === true;
  const selfieRequired = faceVerificationEnforced && faceVerificationConfigured;
  const faceMisconfigured = faceVerificationEnforced && !faceVerificationConfigured;

  // Get user location
  const requestLocation = useCallback((sessionOverride?: ActiveSession | null) => {
    const session = sessionOverride ?? selectedSession;
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(loc);
        setLocationError(null);
        if (session?.geofence) {
          setGeofenceCheck(checkLocationAgainstSessionGeofence(session.geofence, loc.lat, loc.lng));
        } else {
          setGeofenceCheck(null);
        }
      },
      (err) => {
        setLocationError(`Location error: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [selectedSession]);

  useEffect(() => {
    if (!userLocation || !selectedSession?.geofence) return;
    setGeofenceCheck(
      checkLocationAgainstSessionGeofence(selectedSession.geofence, userLocation.lat, userLocation.lng),
    );
  }, [selectedSession, userLocation]);

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 480, height: 480 }
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch {
      toast({ title: 'Camera Error', description: 'Could not access camera', variant: 'destructive' });
    }
  }, [toast]);

  // Capture selfie
  const captureSelfie = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = 480;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, 480, 480);
    const dataUrl = canvas.toDataURL('image/png');
    setSelfieBase64(dataUrl);
    // Stop camera
    const stream = video.srcObject as MediaStream;
    stream?.getTracks().forEach(t => t.stop());
    setCameraActive(false);
  }, []);

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
      setMarkingStep('done');
      queryClient.invalidateQueries({ queryKey: ['active-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-sessions'] });
      toast({
        title: 'Attendance Marked Successfully!',
        description: selectedSession?.geofence
          ? `Geo: ${data.geofenceValidated ? '✅ Verified' : '❌ Failed'} | Face: ${data.faceVerified ? '✅ Verified' : faceVerificationMode === 'live' ? '❌ No match' : '⚠️ Skipped'}`
          : `Marked present | Face: ${data.faceVerified ? '✅ Verified' : faceVerificationMode === 'live' ? '❌ No match' : '⚠️ Skipped'}`,
      });
    },
    onError: (err) => {
      setMarkingStep('select');
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const geoRequiredForSession = (session: ActiveSession) =>
    captureMethodRequiresGeofence(session.captureMethod);

  // Submit attendance
  const handleSubmit = () => {
    if (!currentUser || !selectedSession) return;
    if (!userLocation) return;
    if (geoRequiredForSession(selectedSession) && !selectedSession.geofence) {
      toast({ title: 'Geofence required', description: 'This session requires a geofence — contact faculty.', variant: 'destructive' });
      return;
    }
    if (geofenceCheck?.requiresGeofence && !geofenceCheck.inside) {
      toast({ title: 'Outside geofence', description: geofenceStatusLabel(geofenceCheck), variant: 'destructive' });
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
    setMarkingStep('submitting');
    markMutation.mutate({
      sessionId: selectedSession.id,
      studentId: currentUser.id,
      latitude: userLocation?.lat,
      longitude: userLocation?.lng,
      selfieBase64,
      captureMethod: 'self_geo_face',
    });
  };

  // Reset
  const handleReset = () => {
    setSelectedSession(null);
    setSelfieBase64(null);
    setUserLocation(null);
    setLocationError(null);
    setGeofenceCheck(null);
    setCameraActive(false);
    setMarkingStep('select');
  };

  if (!currentUser) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: UOH_NAVY }}>
            <ScanFace className="h-5 w-5" />
            Mark Your Attendance
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Self-mark with geofence verification & selfie capture</p>
        </div>
        {markingStep !== 'select' && (
          <Button variant="outline" size="sm" onClick={handleReset}>
            Start Over
          </Button>
        )}
      </div>

      {faceMisconfigured && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          Face verification is enforced in Settings but the verification API is not configured. Attendance marking is blocked until an administrator sets FACE_VERIFICATION_API_URL.
        </div>
      )}
      {faceVerificationMode === 'demo' && !faceVerificationEnforced && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          Face verification runs in demo mode (no external API). Selfies are stored for audit; matching uses a placeholder until FACE_VERIFICATION_API_URL is configured.
        </div>
      )}
      {faceVerificationMode === 'live' && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-xs text-green-800">
          Live face verification is active{faceVerificationEnforced ? ' and enforced' : ''}. Your selfie will be matched against your profile photo.
        </div>
      )}

      {/* Step 1: Select Session */}
      {markingStep === 'select' && (
        <div className="space-y-3">
          {activeLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-lg" />)}
            </div>
          ) : activeSessions.length === 0 ? (
            <Card className="py-8">
              <CardContent className="flex flex-col items-center text-center">
                <Clock className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium">No Active Sessions</p>
                <p className="text-xs text-muted-foreground mt-1">There are no attendance sessions currently open for marking.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {activeSessions.map((session) => (
                <Card
                  key={session.id}
                  className={cn(
                    'cursor-pointer transition-all hover:shadow-md py-3',
                    session.alreadyMarked ? 'opacity-60' : 'hover:ring-2 hover:ring-[#1A3C6E]/30',
                    selectedSession?.id === session.id && 'ring-2 ring-[#1A3C6E]'
                  )}
                  onClick={() => {
                    if (!session.alreadyMarked) {
                      setSelectedSession(session);
                      setUserLocation(null);
                      setGeofenceCheck(null);
                      setLocationError(null);
                      requestLocation(session);
                      setMarkingStep('location');
                    }
                  }}
                >
                  <CardContent className="px-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className="text-[10px] font-mono" style={{ backgroundColor: UOH_NAVY, color: '#fff' }}>
                            {session.course?.code || 'N/A'}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
                            Live
                          </Badge>
                        </div>
                        <p className="text-sm font-medium truncate">{session.course?.name || 'Unknown'}</p>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{session.startTime}</span>
                          {session.geofence && (
                            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{session.geofence.name}</span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0">
                        {session.alreadyMarked ? (
                          <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Marked
                          </Badge>
                        ) : (
                          <Button size="sm" className="h-7 text-xs bg-[#1A3C6E] hover:bg-[#1A3C6E]/90 text-white">
                            Mark
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 2: Location + Camera */}
      {markingStep === 'location' && selectedSession && (
        <div className="space-y-4">
          <Card className="py-3">
            <CardContent className="px-4 space-y-4">
              {/* Selected session info */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Badge className="font-mono text-xs" style={{ backgroundColor: UOH_NAVY, color: '#fff' }}>
                  {selectedSession.course?.code}
                </Badge>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{selectedSession.course?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedSession.startTime} • {selectedSession.geofence?.name || 'No geofence'}
                  </p>
                </div>
              </div>

              {/* Location Status */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Navigation className="h-3.5 w-3.5" /> Location Verification
                </Label>
                {userLocation ? (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                    <ShieldCheck className="h-4 w-4 text-green-600" />
                    <div className="text-xs">
                      <p className="font-medium text-green-700 dark:text-green-400">Location Acquired</p>
                      <p className="text-green-600 dark:text-green-500">
                        {userLocation.lat.toFixed(6)}, {userLocation.lng.toFixed(6)}
                      </p>
                    </div>
                  </div>
                ) : locationError ? (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                    <ShieldAlert className="h-4 w-4 text-red-600" />
                    <div className="text-xs">
                      <p className="font-medium text-red-700 dark:text-red-400">Location Error</p>
                      <p className="text-red-600 dark:text-red-500">{locationError}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <Loader2 className="h-4 w-4 text-amber-600 animate-spin" />
                    <p className="text-xs text-amber-700 dark:text-amber-400">Acquiring location...</p>
                  </div>
                )}
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => requestLocation()}>
                  <Navigation className="h-3 w-3 mr-1" /> Refresh Location
                </Button>
                {selectedSession.geofence && userLocation && geofenceCheck && (
                  <div className={cn(
                    'flex items-center gap-2 p-2.5 rounded-lg border text-xs',
                    geofenceCheck.inside
                      ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                      : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800',
                  )}>
                    {geofenceCheck.inside ? (
                      <ShieldCheck className="h-4 w-4 text-green-600 shrink-0" />
                    ) : (
                      <ShieldAlert className="h-4 w-4 text-red-600 shrink-0" />
                    )}
                    <span className={geofenceCheck.inside ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}>
                      {geofenceStatusLabel(geofenceCheck)}
                    </span>
                  </div>
                )}
                {selectedSession.geofence && !userLocation && (
                  <p className="text-[10px] text-muted-foreground">Geofence: {selectedSession.geofence.name}</p>
                )}
              </div>

              {/* Camera / Selfie */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Camera className="h-3.5 w-3.5" /> Selfie Capture {selfieRequired ? '(Required)' : '(Optional)'}
                </Label>
                {selfieBase64 ? (
                  <div className="flex items-center gap-3">
                    <div className="h-20 w-20 rounded-full overflow-hidden border-2 border-green-400 shadow-md">
                      <img src={selfieBase64} alt="Captured selfie" className="h-full w-full object-cover" />
                    </div>
                    <div className="text-xs">
                      <p className="font-medium text-green-700 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Selfie Captured
                      </p>
                      <p className="text-muted-foreground mt-0.5">
                        {faceVerificationMode === 'live'
                          ? 'Will be matched against your profile photo when you submit.'
                          : faceVerificationMode === 'demo'
                            ? 'Stored for audit — demo matching only (no live API).'
                            : 'Stored for audit — face matching is not configured.'}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" className="text-xs h-7 ml-auto" onClick={() => setSelfieBase64(null)}>
                      Retake
                    </Button>
                  </div>
                ) : cameraActive ? (
                  <div className="space-y-2">
                    <div className="relative w-48 h-48 mx-auto rounded-full overflow-hidden border-4 border-[#1A3C6E]/30">
                      <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover scale-x-[-1]" />
                    </div>
                    <Button onClick={captureSelfie} className="w-full max-w-[200px] mx-auto flex bg-[#1A3C6E] hover:bg-[#1A3C6E]/90 text-white" size="sm">
                      <Camera className="h-4 w-4 mr-2" /> Capture
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5" onClick={startCamera}>
                      <Video className="h-3.5 w-3.5" /> Open Camera
                    </Button>
                    <span className="text-xs text-muted-foreground">or</span>
                    <label className="cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => setSelfieBase64(ev.target?.result as string);
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5" asChild>
                        <span><Upload className="h-3.5 w-3.5" /> Upload Photo</span>
                      </Button>
                    </label>
                  </div>
                )}
              </div>

              <canvas ref={canvasRef} className="hidden" />

              {/* Submit Button */}
              <div className="flex items-center gap-3 pt-2 border-t">
                <Button
                  className="bg-[#1A3C6E] hover:bg-[#1A3C6E]/90 text-white gap-2"
                  disabled={
                    markMutation.isPending ||
                    faceMisconfigured ||
                    !userLocation ||
                    (selfieRequired && !selfieBase64) ||
                    (selectedSession.geofence
                      ? geofenceCheck?.requiresGeofence && !geofenceCheck.inside
                      : geoRequiredForSession(selectedSession))
                  }
                  onClick={handleSubmit}
                >
                  {markMutation.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Verifying...</>
                  ) : (
                    <><UserCheck className="h-4 w-4" /> Mark Attendance</>
                  )}
                </Button>
                {!userLocation && (
                  <span className="text-xs text-amber-600">⚠️ Location required</span>
                )}
                {selfieRequired && !selfieBase64 && userLocation && (
                  <span className="text-xs text-amber-600">⚠️ Selfie required for face verification</span>
                )}
                {!selfieRequired && !selfieBase64 && userLocation && faceVerificationMode === 'disabled' && (
                  <span className="text-xs text-muted-foreground">Selfie optional (face verification off)</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step: Submitting */}
      {markingStep === 'submitting' && (
        <Card className="py-8">
          <CardContent className="flex flex-col items-center text-center">
            <Loader2 className="h-10 w-10 animate-spin text-[#1A3C6E] mb-3" />
            <p className="text-sm font-medium">Verifying your attendance...</p>
            <p className="text-xs text-muted-foreground mt-1">Checking geofence & saving selfie</p>
          </CardContent>
        </Card>
      )}

      {/* Step: Done */}
      {markingStep === 'done' && markMutation.data && (
        <Card className="py-6">
          <CardContent className="flex flex-col items-center text-center space-y-3">
            <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-bold">Attendance Marked!</h3>
            <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
              <div className={cn(
                'p-3 rounded-lg border',
                markMutation.data.geofenceValidated
                  ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                  : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
              )}>
                <MapPin className={cn('h-5 w-5 mx-auto mb-1', markMutation.data.geofenceValidated ? 'text-green-600' : 'text-red-600')} />
                <p className="text-xs font-medium">Geofence</p>
                <p className={cn('text-xs', markMutation.data.geofenceValidated ? 'text-green-700' : 'text-red-700')}>
                  {markMutation.data.geofenceValidated ? '✅ Verified' : '❌ Failed'}
                </p>
                {markMutation.data.distanceFromCenter != null && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">{Math.round(markMutation.data.distanceFromCenter)}m from center</p>
                )}
              </div>
              <div className={cn(
                'p-3 rounded-lg border',
                markMutation.data.faceVerified
                  ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                  : 'bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800'
              )}>
                <ScanFace className={cn('h-5 w-5 mx-auto mb-1', markMutation.data.faceVerified ? 'text-green-600' : 'text-amber-600')} />
                <p className="text-xs font-medium">Selfie</p>
                <p className={cn('text-xs', markMutation.data.faceVerified ? 'text-green-700' : 'text-amber-700')}>
                  {markMutation.data.faceVerified ? 'Saved' : 'Not captured'}
                </p>
                {markMutation.data.confidence != null && (
                  <p className="text-[10px] text-muted-foreground mt-0.5">Confidence: {Math.round(markMutation.data.confidence * 100)}%</p>
                )}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleReset}>Mark Another Session</Button>
          </CardContent>
        </Card>
      )}

      {/* Already marked sessions detail */}
      {markingStep === 'select' && activeSessions.some(s => s.alreadyMarked) && (
        <div className="mt-4">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Already Marked Today</h4>
          <div className="space-y-2">
            {activeSessions.filter(s => s.alreadyMarked).map(session => (
              <Card key={session.id} className="py-2">
                <CardContent className="px-4 flex items-center gap-3">
                  <Badge className="font-mono text-[10px]" style={{ backgroundColor: UOH_NAVY, color: '#fff' }}>
                    {session.course?.code}
                  </Badge>
                  <span className="text-sm font-medium truncate">{session.course?.name}</span>
                  <div className="ml-auto flex items-center gap-1.5">
                    {session.existingRecord?.geofenceValidated && (
                      <Badge variant="outline" className="text-[9px] bg-green-50 text-green-700 border-green-200">
                        <MapPin className="h-2.5 w-2.5 mr-0.5" /> Geo ✓
                      </Badge>
                    )}
                    {session.existingRecord?.faceVerified && (
                      <Badge variant="outline" className="text-[9px] bg-green-50 text-green-700 border-green-200">
                        <ScanFace className="h-2.5 w-2.5 mr-0.5" /> Face ✓
                      </Badge>
                    )}
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Student Records View ───────────────────────────────────────
function StudentRecordsView() {
  const { data, isLoading } = useQuery<{
    records: Array<{
      id: string; status: string; markedAt: string | null; faceVerified: boolean;
      session: { sessionDate: string; startTime: string; endTime: string; course: { name: string; code: string } };
    }>;
    summary: { total: number; present: number; percentage: number };
  }>({
    queryKey: ['attendance-my-records'],
    queryFn: () => fetch('/api/attendance/my-records').then((r) => {
      if (!r.ok) throw new Error('Failed to load records');
      return r.json();
    }),
  });

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{data?.summary.total ?? 0}</p><p className="text-xs text-muted-foreground">Total Sessions</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-green-600">{data?.summary.present ?? 0}</p><p className="text-xs text-muted-foreground">Present</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{data?.summary.percentage ?? 0}%</p><p className="text-xs text-muted-foreground">Attendance Rate</p></CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Attendance History</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Face</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.records ?? []).map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{r.session.sessionDate}</TableCell>
                  <TableCell>{r.session.course.code}</TableCell>
                  <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                  <TableCell>{r.faceVerified ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <XCircle className="h-4 w-4 text-muted-foreground" />}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Admin Sessions View ────────────────────────────────────────

interface SessionRecord {
  id: string;
  status: string;
  markedAt: string | null;
  student: { id: string; name: string; email: string; employeeId: string | null };
}

interface UnmarkedStudent {
  id: string;
  name: string;
  email: string;
  employeeId: string | null;
}

const RECORD_STATUS_STYLES: Record<string, string> = {
  present: 'bg-green-100 text-green-800 border-green-200',
  absent: 'bg-red-100 text-red-800 border-red-200',
  late: 'bg-amber-100 text-amber-800 border-amber-200',
};

function SessionDetailDialog({
  sessionId,
  open,
  onOpenChange,
}: {
  sessionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{
    session: AttendanceSession & { records: SessionRecord[] };
    unmarkedStudents: UnmarkedStudent[];
  }>({
    queryKey: ['attendance-session', sessionId],
    queryFn: () => fetch(`/api/attendance/sessions/${sessionId}`).then(async (r) => {
      if (!r.ok) throw new Error('Failed to load session');
      return r.json();
    }),
    enabled: open && !!sessionId,
  });

  const markMutation = useMutation({
    mutationFn: ({ studentId, status }: { studentId: string; status: string }) =>
      fetch(`/api/attendance/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark', studentId, status }),
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Failed to mark');
        return d;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-session', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['attendance-sessions'] });
      toast({ title: 'Attendance updated' });
    },
    onError: (err: Error) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const session = data?.session;
  const records = session?.records ?? [];
  const unmarked = data?.unmarkedStudents ?? [];
  const isActive = session?.status === 'active';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Session Detail
          </DialogTitle>
          {session && (
            <DialogDescription>
              {session.course?.code} — {format(new Date(session.sessionDate + 'T00:00:00'), 'MMM dd, yyyy')} · {session.startTime}
            </DialogDescription>
          )}
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2 py-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : session ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={cn('text-[10px]', STATUS_CONFIG[session.status]?.className)}>
                {STATUS_CONFIG[session.status]?.label ?? session.status}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {session.presentCount} present · {session.absentCount} absent · {records.length} marked
              </span>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Roster</h4>
              {records.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">No attendance records yet</p>
              ) : (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {records.map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/40">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{r.student.name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{r.student.employeeId || r.student.email}</p>
                      </div>
                      <Badge variant="outline" className={cn('text-[10px] capitalize shrink-0', RECORD_STATUS_STYLES[r.status] ?? '')}>
                        {r.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {unmarked.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Unmarked ({unmarked.length})
                </h4>
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {unmarked.map((s) => (
                    <div key={s.id} className="flex items-center justify-between gap-2 p-2 rounded-lg border border-dashed">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{s.name}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">{s.employeeId || s.email}</p>
                      </div>
                      {isActive && (
                        <div className="flex gap-1 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[10px] text-green-700 border-green-300"
                            disabled={markMutation.isPending}
                            onClick={() => markMutation.mutate({ studentId: s.id, status: 'present' })}
                          >
                            Present
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[10px] text-red-700 border-red-300"
                            disabled={markMutation.isPending}
                            onClick={() => markMutation.mutate({ studentId: s.id, status: 'absent' })}
                          >
                            Absent
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4 text-center">Session not found</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const TIMETABLE_DAYS = [
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
  { value: '0', label: 'Sunday' },
] as const;

const TIMETABLE_WRITE_ROLES = new Set(['super_admin', 'admin', 'hod', 'faculty', 'lab_assistant']);

interface TimetableSlotRecord {
  id: string;
  courseId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  roomNumber: string | null;
  building: string | null;
  academicYear: string | null;
  isActive: boolean;
  course?: { id: string; code: string; name: string };
  _count?: { attendanceSessions: number };
}

function FacultyTimetableEditor() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<TimetableSlotRecord | null>(null);
  const [form, setForm] = useState({
    courseId: '',
    dayOfWeek: '1',
    startTime: '09:00',
    endTime: '10:00',
    roomNumber: '',
    building: '',
    academicYear: '2025-2026',
    isActive: true,
  });

  const { data: coursesData } = useQuery({
    queryKey: ['faculty-timetable-courses'],
    queryFn: () => fetch('/api/lms/courses?limit=200').then(r => r.json()),
  });
  const courses: CourseOption[] = coursesData?.courses ?? [];

  const { data: slotsData, isLoading } = useQuery({
    queryKey: ['faculty-timetable-slots'],
    queryFn: () => fetch('/api/masters/timetable-slots?limit=200&includeInactive=true').then(r => r.json()),
  });
  const slots: TimetableSlotRecord[] = slotsData?.slots ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['faculty-timetable-slots'] });
    queryClient.invalidateQueries({ queryKey: ['timetable-today'] });
    queryClient.invalidateQueries({ queryKey: ['timetable-slot-picker'] });
    queryClient.invalidateQueries({ queryKey: ['masters-timetable-slots'] });
  };

  const saveMut = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const isEdit = Boolean(payload.id);
      const res = await fetch('/api/masters/timetable-slots', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save timetable slot');
      return data;
    },
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      toast({ title: 'Timetable saved', description: 'Weekly schedule updated.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Could not save', description: err.message, variant: 'destructive' });
    },
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/masters/timetable-slots?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete slot');
      return data;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: 'Slot removed' });
    },
    onError: (err: Error) => {
      toast({ title: 'Could not delete', description: err.message, variant: 'destructive' });
    },
  });

  const openNew = () => {
    setEditItem(null);
    setForm({
      courseId: courses[0]?.id || '',
      dayOfWeek: '1',
      startTime: '09:00',
      endTime: '10:00',
      roomNumber: '',
      building: '',
      academicYear: '2025-2026',
      isActive: true,
    });
    setDialogOpen(true);
  };

  const openEdit = (item: TimetableSlotRecord) => {
    setEditItem(item);
    setForm({
      courseId: item.courseId,
      dayOfWeek: String(item.dayOfWeek),
      startTime: item.startTime,
      endTime: item.endTime,
      roomNumber: item.roomNumber || '',
      building: item.building || '',
      academicYear: item.academicYear || '2025-2026',
      isActive: item.isActive ?? true,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.courseId) {
      toast({ title: 'Select a course', variant: 'destructive' });
      return;
    }
    const payload = {
      courseId: form.courseId,
      semesterId: null,
      dayOfWeek: parseInt(form.dayOfWeek, 10),
      startTime: form.startTime,
      endTime: form.endTime,
      roomNumber: form.roomNumber || null,
      building: form.building || null,
      semester: null,
      academicYear: form.academicYear || null,
      isActive: form.isActive,
    };
    if (editItem) saveMut.mutate({ id: editItem.id, ...payload });
    else saveMut.mutate(payload);
  };

  const dayLabel = (d: number) => TIMETABLE_DAYS.find(x => x.value === String(d))?.label ?? DAY_LABELS[d];

  const sortedSlots = [...slots].sort((a, b) =>
    a.dayOfWeek !== b.dayOfWeek ? a.dayOfWeek - b.dayOfWeek : a.startTime.localeCompare(b.startTime),
  );

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" style={{ color: UOH_NAVY }} />
              Weekly Timetable
            </CardTitle>
            <CardDescription>
              Configure when your courses meet each week — used for today&apos;s class list and attendance sessions
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={openNew}
            className="gap-1.5 bg-[#1A3C6E] hover:bg-[#1A3C6E]/90 text-white"
            disabled={courses.length === 0}
          >
            <Plus className="h-4 w-4" /> Add slot
          </Button>
        </CardHeader>
        <CardContent>
          {courses.length === 0 && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-3 mb-4">
              No courses are assigned to you yet. Ask an admin to assign you as instructor on an LMS course.
            </p>
          )}
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : sortedSlots.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No timetable slots yet. Add your first weekly class slot above.
            </p>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Course</TableHead>
                    <TableHead>Day</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedSlots.map(slot => (
                    <TableRow key={slot.id}>
                      <TableCell>
                        <span className="font-mono text-xs font-semibold" style={{ color: UOH_NAVY }}>{slot.course?.code}</span>
                        <p className="text-xs text-muted-foreground truncate max-w-[180px]">{slot.course?.name}</p>
                      </TableCell>
                      <TableCell className="text-sm">{dayLabel(slot.dayOfWeek)}</TableCell>
                      <TableCell className="text-sm font-mono">{slot.startTime}–{slot.endTime}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {[slot.building, slot.roomNumber].filter(Boolean).join(' · ') || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={slot.isActive ? 'default' : 'secondary'} className="text-[10px]">
                          {slot.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(slot)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            disabled={deleteMut.isPending}
                            onClick={() => {
                              if (slot._count?.attendanceSessions) {
                                openEdit({ ...slot, isActive: false });
                                toast({
                                  title: 'Has attendance history',
                                  description: 'Set status to Inactive instead of deleting.',
                                });
                                return;
                              }
                              if (window.confirm('Remove this timetable slot?')) {
                                deleteMut.mutate(slot.id);
                              }
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editItem ? 'Edit timetable slot' : 'Add timetable slot'}</DialogTitle>
            <DialogDescription>Define a recurring weekly class period for one of your courses</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 py-2">
            <div className="col-span-2">
              <Label>Course *</Label>
              <Select value={form.courseId} onValueChange={v => setForm(f => ({ ...f, courseId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
                <SelectContent>
                  {courses.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Day *</Label>
              <Select value={form.dayOfWeek} onValueChange={v => setForm(f => ({ ...f, dayOfWeek: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIMETABLE_DAYS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Academic year</Label>
              <Input value={form.academicYear} onChange={e => setForm(f => ({ ...f, academicYear: e.target.value }))} placeholder="2025-2026" />
            </div>
            <div><Label>Start *</Label><Input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} /></div>
            <div><Label>End *</Label><Input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} /></div>
            <div><Label>Building</Label><Input value={form.building} onChange={e => setForm(f => ({ ...f, building: e.target.value }))} placeholder="CSE Block" /></div>
            <div><Label>Room</Label><Input value={form.roomNumber} onChange={e => setForm(f => ({ ...f, roomNumber: e.target.value }))} placeholder="CSE-301" /></div>
            <div className="col-span-2">
              <Label>Status</Label>
              <Select value={form.isActive ? 'active' : 'inactive'} onValueChange={v => setForm(f => ({ ...f, isActive: v === 'active' }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleSubmit}
              disabled={saveMut.isPending || !form.courseId}
              className="bg-[#1A3C6E] hover:bg-[#1A3C6E]/90 text-white"
            >
              {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {editItem ? 'Save changes' : 'Add slot'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface TimetableSlotRow {
  id: string;
  courseId: string;
  course: { id: string; name: string; code: string; enrollmentCount?: number };
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  roomNumber: string | null;
  building: string | null;
  session: { id: string; status: string; presentCount: number; expectedCount: number } | null;
}

function ScheduleTypeBadge({ timetableSlotId }: { timetableSlotId: string | null }) {
  if (timetableSlotId) {
    return (
      <Badge className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-0">
        On schedule
      </Badge>
    );
  }
  return <Badge variant="outline" className="text-[10px] text-muted-foreground">Ad-hoc</Badge>;
}

function FacultyScheduleCard({
  onStartSlot,
  onQuickStart,
  onOpenSession,
  isCreating,
}: {
  onStartSlot: (slot: TimetableSlotRow, dateStr: string) => void;
  onQuickStart: (slot: TimetableSlotRow, dateStr: string) => void;
  onOpenSession: (sessionId: string) => void;
  isCreating: boolean;
}) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const dayLabel = DAY_LABELS[new Date().getDay()];

  const { data, isLoading, isError, refetch } = useQuery<{ slots: TimetableSlotRow[]; total: number }>({
    queryKey: ['timetable-today', todayStr],
    queryFn: () => fetchJson(`/api/timetable?date=${todayStr}`),
    staleTime: 60_000,
  });

  const slots = data?.slots ?? [];

  return (
    <Card className="border-l-4" style={{ borderLeftColor: UOH_NAVY }}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CalendarIcon className="h-4 w-4" style={{ color: UOH_NAVY }} />
              Today&apos;s classes
            </CardTitle>
            <CardDescription className="text-xs">
              {format(new Date(), 'EEEE, MMM d')} ({dayLabel}) — start sessions aligned to timetable
            </CardDescription>
          </div>
          {slots.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">{slots.length} slot{slots.length !== 1 ? 's' : ''}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : isError ? (
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-destructive">Could not load today&apos;s timetable.</p>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => refetch()}>Retry</Button>
          </div>
        ) : slots.length === 0 ? (
          <p className="text-sm text-muted-foreground">No timetable slots scheduled for today in your scope.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {slots.map(slot => {
              const activeSession = slot.session?.status === 'active' ? slot.session : null;
              const room = [slot.building, slot.roomNumber].filter(Boolean).join(' · ');
              return (
                <div key={slot.id} className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-mono font-semibold" style={{ color: UOH_NAVY }}>{slot.course.code}</p>
                      <p className="text-sm font-medium leading-tight">{slot.course.name}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {slot.startTime}–{slot.endTime}
                    </Badge>
                  </div>
                  {room && (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />{room}
                    </p>
                  )}
                  {activeSession ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] text-green-700 dark:text-green-400">
                        Session live · {activeSession.presentCount}/{activeSession.expectedCount} present
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs ml-auto"
                        onClick={() => onOpenSession(activeSession.id)}
                      >
                        <Eye className="h-3 w-3 mr-1" />Open
                      </Button>
                    </div>
                  ) : slot.session?.status === 'completed' ? (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px]">Completed</Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => onStartSlot(slot, todayStr)}
                      >
                        Makeup session
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        className="h-7 text-xs bg-[#1A3C6E] hover:bg-[#1A3C6E]/90 text-white"
                        disabled={isCreating}
                        onClick={() => onQuickStart(slot, todayStr)}
                      >
                        {isCreating ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />}
                        Start now
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => onStartSlot(slot, todayStr)}
                      >
                        Customize
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AdminSessionsView() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { sectionContext, setSectionContext } = useAppStore();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 20;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailSessionId, setDetailSessionId] = useState<string | null>(null);
  const [newSession, setNewSession] = useState({
    courseId: '', sessionDate: '', startTime: '09:00', endTime: '10:30',
    captureMethod: 'manual', geofenceId: '', timetableSlotId: '' as string,
  });

  const startFromTimetableSlot = useCallback((slot: TimetableSlotRow, dateStr: string) => {
    setNewSession({
      courseId: slot.courseId,
      sessionDate: dateStr,
      startTime: slot.startTime,
      endTime: slot.endTime,
      captureMethod: 'manual',
      geofenceId: '',
      timetableSlotId: slot.id,
    });
    setDialogOpen(true);
  }, []);

  const queryParams = new URLSearchParams();
  if (statusFilter !== 'all') queryParams.set('status', statusFilter);
  if (courseFilter !== 'all') queryParams.set('courseId', courseFilter);
  if (methodFilter !== 'all') queryParams.set('captureMethod', methodFilter);
  if (dateFilter) queryParams.set('date', format(dateFilter, 'yyyy-MM-dd'));
  queryParams.set('page', String(page));
  queryParams.set('limit', String(limit));

  const { data, isLoading, isError } = useQuery<SessionsResponse>({
    queryKey: ['attendance-sessions', statusFilter, courseFilter, methodFilter, dateFilter, page],
    queryFn: () => fetch(`/api/attendance/sessions?${queryParams.toString()}`).then(r => r.json()),
  });

  const { data: coursesData } = useQuery<{ courses: CourseOption[] }>({
    queryKey: ['courses-list'],
    queryFn: () => fetch('/api/lms/courses?limit=100').then(r => r.json()),
  });

  const { data: geofencesData, isError: geofencesError } = useQuery<{ geofences: GeofenceOption[] }>({
    queryKey: ['geofences-list'],
    queryFn: async () => {
      const res = await fetch('/api/geofences');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load geofences');
      return data;
    },
  });

  const { data: slotPickerData } = useQuery<{ slots: TimetableSlotRow[] }>({
    queryKey: ['timetable-slot-picker', newSession.courseId, newSession.sessionDate],
    queryFn: () =>
      fetchJson(`/api/timetable?courseId=${newSession.courseId}&date=${newSession.sessionDate}`),
    enabled: !!newSession.courseId && !!newSession.sessionDate,
  });

  const availableSlots = slotPickerData?.slots ?? [];
  const slotLocked = !!newSession.timetableSlotId;

  const courses = coursesData?.courses ?? [];
  const geofences = geofencesData?.geofences ?? [];
  const geofenceRequired = captureMethodRequiresGeofence(newSession.captureMethod);
  const sessions = data?.sessions ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / limit));
  const hasActiveFilters = statusFilter !== 'all' || courseFilter !== 'all' || methodFilter !== 'all' || dateFilter !== undefined;

  useEffect(() => {
    if (!sectionContext?.attendanceSessionId) return;
    setDetailSessionId(sectionContext.attendanceSessionId);
    setDetailDialogOpen(true);
    setSectionContext(null);
  }, [sectionContext, setSectionContext]);

  const openSessionDetail = (id: string) => {
    setDetailSessionId(id);
    setDetailDialogOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch('/api/attendance/sessions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      }).then(async r => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Failed to create session');
        return data;
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['timetable-today'] });
      queryClient.invalidateQueries({ queryKey: ['timetable-slot-picker'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setDialogOpen(false);
      setNewSession({
        courseId: '', sessionDate: '', startTime: '09:00', endTime: '10:30',
        captureMethod: 'manual', geofenceId: '', timetableSlotId: '',
      });
      toast({ title: 'Session Created', description: 'Attendance session created successfully.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const quickStartFromSlot = useCallback((slot: TimetableSlotRow, dateStr: string) => {
    const suggested = suggestGeofenceForBuilding(geofences, slot.building);
    createMutation.mutate({
      courseId: slot.courseId,
      sessionDate: dateStr,
      startTime: slot.startTime,
      endTime: slot.endTime,
      captureMethod: 'self_geo_face',
      timetableSlotId: slot.id,
      geofenceId: suggested?.id,
    });
  }, [createMutation, geofences]);

  const completeMutation = useMutation({
    mutationFn: (sessionId: string) =>
      fetch(`/api/attendance/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete' }),
      }).then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error(err.error ?? 'Failed to complete session');
        }
        return r.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['timetable-today'] });
      queryClient.invalidateQueries({ queryKey: ['timetable-slot-picker'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: 'Session completed', description: 'Attendance summary anchored for audit trail.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  return (
    <div className="space-y-4">
      <FacultyScheduleCard
        onStartSlot={startFromTimetableSlot}
        onQuickStart={quickStartFromSlot}
        onOpenSession={openSessionDetail}
        isCreating={createMutation.isPending}
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { title: 'Total Sessions', value: data?.summary?.totalSessions ?? 0, icon: ScanLine, color: UOH_NAVY, bg: 'bg-[#1A3C6E]/10' },
          { title: 'Active', value: data?.summary?.activeCount ?? 0, icon: Clock, color: '#16a34a', bg: 'bg-green-100 dark:bg-green-900/30' },
          { title: 'Completed', value: data?.summary?.completedCount ?? 0, icon: CheckCircle2, color: UOH_NAVY, bg: 'bg-[#1A3C6E]/10' },
          { title: 'Avg Rate', value: `${data?.summary?.avgAttendanceRate ?? 0}%`, icon: Users, color: (data?.summary?.avgAttendanceRate ?? 0) >= 75 ? '#16a34a' : '#d97706', bg: 'bg-amber-100 dark:bg-amber-900/30' },
        ].map(card => {
          const Icon = card.icon;
          return (
            <Card key={card.title} className="py-3">
              <CardContent className="flex items-center gap-3 px-3">
                <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', card.bg)}>
                  <Icon className="h-4 w-4" style={{ color: card.color }} />
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground">{card.title}</span>
                  <div className="text-lg font-bold leading-tight" style={{ color: card.color }}>
                    {isLoading ? <Skeleton className="h-5 w-10" /> : card.value}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <Card><CardContent className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[130px]" size="sm"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
          <Select value={courseFilter} onValueChange={v => { setCourseFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[180px]" size="sm"><SelectValue placeholder="Course" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Courses</SelectItem>
              {courses.map(c => <SelectItem key={c.id} value={c.id}>{c.code}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={methodFilter} onValueChange={v => { setMethodFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[140px]" size="sm"><SelectValue placeholder="Method" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Methods</SelectItem>
              {Object.entries(CAPTURE_METHOD_CONFIG).map(([k, { label }]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn('w-[160px] justify-start text-left', !dateFilter && 'text-muted-foreground')}>
                <CalendarIcon className="mr-1.5 h-3.5 w-3.5" />{dateFilter ? format(dateFilter, 'MMM dd') : 'Date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFilter} onSelect={d => { setDateFilter(d ?? undefined); setDatePickerOpen(false); setPage(1); }} />
            </PopoverContent>
          </Popover>
          {hasActiveFilters && <Button variant="ghost" size="sm" onClick={() => { setStatusFilter('all'); setCourseFilter('all'); setMethodFilter('all'); setDateFilter(undefined); setPage(1); }} className="text-xs"><XCircle className="h-3.5 w-3.5 mr-1" />Clear</Button>}
          <div className="ml-auto">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild><Button size="sm" className="gap-1.5 bg-[#1A3C6E] hover:bg-[#1A3C6E]/90 text-white"><Plus className="h-3.5 w-3.5" />New Session</Button></DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader><DialogTitle>Create Session</DialogTitle><DialogDescription>Set up attendance session</DialogDescription></DialogHeader>
                <div className="grid gap-3 py-3">
                  <div className="grid gap-1.5"><Label className="text-xs">Course *</Label><Select value={newSession.courseId} onValueChange={v => setNewSession(p => ({ ...p, courseId: v, timetableSlotId: '' }))}><SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger><SelectContent>{courses.map(c => <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>)}</SelectContent></Select></div>
                  <div className="grid gap-1.5"><Label className="text-xs">Date *</Label><Input type="date" value={newSession.sessionDate} onChange={e => setNewSession(p => ({ ...p, sessionDate: e.target.value, timetableSlotId: '' }))} /></div>
                  {newSession.courseId && newSession.sessionDate && (
                    <div className="grid gap-1.5">
                      <Label className="text-xs">Timetable slot</Label>
                      <Select
                        value={newSession.timetableSlotId || '__none__'}
                        onValueChange={v => {
                          if (v === '__none__') {
                            setNewSession(p => ({ ...p, timetableSlotId: '' }));
                            return;
                          }
                          const slot = availableSlots.find(s => s.id === v);
                          if (slot) {
                            const suggested = suggestGeofenceForBuilding(geofences, slot.building);
                            setNewSession(p => ({
                              ...p,
                              timetableSlotId: slot.id,
                              startTime: slot.startTime,
                              endTime: slot.endTime,
                              geofenceId: suggested?.id ?? p.geofenceId,
                            }));
                          }
                        }}
                      >
                        <SelectTrigger><SelectValue placeholder="Ad-hoc (no slot)" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Ad-hoc (no timetable slot)</SelectItem>
                          {availableSlots.map(s => (
                            <SelectItem key={s.id} value={s.id}>
                              {DAY_LABELS[s.dayOfWeek]} {s.startTime}–{s.endTime}
                              {s.roomNumber ? ` · ${s.roomNumber}` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {availableSlots.length === 0 && (
                        <p className="text-[10px] text-muted-foreground">No timetable slot for this course on the selected day.</p>
                      )}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5"><Label className="text-xs">Start</Label><Input type="time" value={newSession.startTime} readOnly={slotLocked} className={slotLocked ? 'bg-muted' : ''} onChange={e => setNewSession(p => ({ ...p, startTime: e.target.value }))} /></div>
                    <div className="grid gap-1.5"><Label className="text-xs">End</Label><Input type="time" value={newSession.endTime} readOnly={slotLocked} className={slotLocked ? 'bg-muted' : ''} onChange={e => setNewSession(p => ({ ...p, endTime: e.target.value }))} /></div>
                  </div>
                  {slotLocked && (
                    <p className="text-[10px] text-muted-foreground">Times are locked to the selected timetable slot.</p>
                  )}
                  <div className="grid gap-1.5"><Label className="text-xs">Capture Method</Label><Select value={newSession.captureMethod} onValueChange={v => setNewSession(p => ({ ...p, captureMethod: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(CAPTURE_METHOD_CONFIG).map(([k, { label }]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}</SelectContent></Select></div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs">
                      Geofence {geofenceRequired ? '*' : '(optional)'}
                    </Label>
                    <Select
                      value={newSession.geofenceId || '__none__'}
                      onValueChange={v => setNewSession(p => ({ ...p, geofenceId: v === '__none__' ? '' : v }))}
                    >
                      <SelectTrigger><SelectValue placeholder={geofenceRequired ? 'Select geofence' : 'None'} /></SelectTrigger>
                      <SelectContent>
                        {!geofenceRequired && <SelectItem value="__none__">None</SelectItem>}
                        {geofences.map(g => (
                          <SelectItem key={g.id} value={g.id}>
                            {g.name}{g.building ? ` · ${g.building}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {geofenceRequired && !newSession.geofenceId && (
                      <p className="text-[10px] text-amber-600">GPS / Geo+Face sessions require an active geofence zone.</p>
                    )}
                    {geofencesError && (
                      <p className="text-[10px] text-red-600">Could not load geofence list — refresh or contact admin.</p>
                    )}
                  </div>
                </div>
                <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button onClick={() => createMutation.mutate({ courseId: newSession.courseId, sessionDate: newSession.sessionDate, startTime: newSession.startTime, endTime: newSession.endTime, captureMethod: newSession.captureMethod, geofenceId: newSession.geofenceId || undefined, timetableSlotId: newSession.timetableSlotId || undefined })} disabled={createMutation.isPending || !newSession.courseId || !newSession.sessionDate || (geofenceRequired && !newSession.geofenceId)} className="bg-[#1A3C6E] hover:bg-[#1A3C6E]/90 text-white">{createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Create</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardContent></Card>

      {/* Sessions Table */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">All Sessions {data?.total != null && <span className="text-muted-foreground font-normal">({data.total})</span>}</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isError ? (
            <div className="flex flex-col items-center py-12"><AlertTriangle className="h-8 w-8 text-destructive mb-2" /><p className="text-sm">Failed to load</p><Button variant="outline" size="sm" className="mt-3" onClick={() => queryClient.invalidateQueries({ queryKey: ['attendance-sessions'] })}>Retry</Button></div>
          ) : isLoading ? (
            <div className="p-4 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center py-12"><ScanLine className="h-8 w-8 text-muted-foreground/40 mb-2" /><p className="text-sm">No sessions found</p></div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Course</TableHead>
                    <TableHead className="text-xs">Schedule</TableHead>
                    <TableHead className="text-xs">Time</TableHead>
                    <TableHead className="text-xs">Method</TableHead>
                    <TableHead className="text-xs text-center">Present</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs">Verification</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {sessions.map(s => {
                      const methodConf = CAPTURE_METHOD_CONFIG[s.captureMethod] ?? CAPTURE_METHOD_CONFIG.manual;
                      const MethodIcon = methodConf.icon;
                      const statusConf = STATUS_CONFIG[s.status] ?? STATUS_CONFIG.upcoming;
                      const rate = s.expectedCount > 0 ? Math.round((s.presentCount / s.expectedCount) * 100) : 0;
                      return (
                        <TableRow key={s.id}>
                          <TableCell className="text-xs font-medium">{format(new Date(s.sessionDate + 'T00:00:00'), 'MMM dd')}</TableCell>
                          <TableCell><span className="text-xs font-mono" style={{ color: UOH_NAVY }}>{s.course?.code || '—'}</span></TableCell>
                          <TableCell><ScheduleTypeBadge timetableSlotId={s.timetableSlotId} /></TableCell>
                          <TableCell className="text-xs">{s.startTime}</TableCell>
                          <TableCell><div className="flex items-center gap-1"><MethodIcon className="h-3 w-3 text-muted-foreground" /><span className="text-xs">{methodConf.label}</span></div></TableCell>
                          <TableCell className="text-center"><span className={cn('text-xs font-semibold', rate >= 75 ? 'text-green-600' : rate >= 65 ? 'text-amber-600' : 'text-red-600')}>{s.presentCount} ({rate}%)</span></TableCell>
                          <TableCell><Badge variant={statusConf.variant} className={cn('text-[10px]', statusConf.className)}>{statusConf.label}</Badge></TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {s.captureMethod === 'self_geo_face' && (
                                <>
                                  <MapPin className="h-3 w-3 text-green-600" />
                                  <ScanFace className="h-3 w-3 text-green-600" />
                                </>
                              )}
                              {s.captureMethod === 'gps' && <MapPin className="h-3 w-3 text-blue-600" />}
                              {s.captureMethod === 'face' && <ScanFace className="h-3 w-3 text-purple-600" />}
                              {s.captureMethod === 'manual' && <PenLine className="h-3 w-3 text-muted-foreground" />}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => openSessionDetail(s.id)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                              {s.status === 'active' && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-[10px]"
                                  disabled={completeMutation.isPending}
                                  onClick={() => completeMutation.mutate(s.id)}
                                >
                                  Complete
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {totalPages > 1 && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between px-4 py-2">
                    <p className="text-xs text-muted-foreground">Page {page} of {totalPages}</p>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft className="h-3 w-3" /></Button>
                      <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}><ChevronRight className="h-3 w-3" /></Button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <SessionDetailDialog
        sessionId={detailSessionId}
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
      />
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────
export default function AttendanceSection() {
  const { currentUser } = useAppStore();
  const canManageTimetable = useCanManageTimetable();

  if (!currentUser) return null;

  const isStudent = currentUser.role === 'student';
  const isParent = currentUser.role === 'parent';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight" style={{ color: UOH_NAVY }}>
          Attendance Management
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {isStudent
            ? 'Mark your attendance with geofence verification & selfie capture'
            : isParent
              ? "View your ward's attendance records"
              : canManageTimetable
                ? 'Manage sessions, configure your weekly timetable, and track participation'
                : 'Manage attendance sessions, track participation, and verify records'}
        </p>
      </div>

      {isStudent ? (
        <Tabs defaultValue="mark">
          <TabsList>
            <TabsTrigger value="mark" className="gap-1.5 text-xs">
              <ScanLine className="h-4 w-4" /> Mark Attendance
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-1.5 text-xs">
              <Clock className="h-4 w-4" /> My Records
            </TabsTrigger>
          </TabsList>
          <TabsContent value="mark" className="mt-4">
            <StudentMarkAttendance />
          </TabsContent>
          <TabsContent value="history" className="mt-4">
            <StudentRecordsView />
          </TabsContent>
        </Tabs>
      ) : isParent ? (
        <StudentRecordsView />
      ) : canManageTimetable ? (
        <Tabs defaultValue="sessions">
          <TabsList>
            <TabsTrigger value="sessions" className="gap-1.5 text-xs">
              <Users className="h-4 w-4" /> Sessions
            </TabsTrigger>
            <TabsTrigger value="timetable" className="gap-1.5 text-xs">
              <Clock className="h-4 w-4" /> Weekly Timetable
            </TabsTrigger>
          </TabsList>
          <TabsContent value="sessions" className="mt-4">
            <AdminSessionsView />
          </TabsContent>
          <TabsContent value="timetable" className="mt-4">
            <FacultyTimetableEditor />
          </TabsContent>
        </Tabs>
      ) : (
        <AdminSessionsView />
      )}
    </div>
  );
}
