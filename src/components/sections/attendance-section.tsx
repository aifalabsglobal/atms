'use client';

import { useState, useRef, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  ScanLine, Plus, PenLine, ScanFace, MapPin, QrCode,
  Fingerprint, Radio, CalendarIcon, ChevronLeft, ChevronRight,
  MoreHorizontal, Eye, Trash2, Clock, Users, CheckCircle2,
  XCircle, AlertTriangle, Loader2, Search, Camera, Navigation,
  ShieldCheck, ShieldAlert, UserCheck, Upload, Video,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
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
interface GeofenceOption { id: string; name: string }

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
  geofence: { name: string; centerLat?: number; centerLng?: number; radiusMtrs?: number } | null;
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
  geofence: { name: string; centerLat?: number; centerLng?: number; radiusMtrs?: number } | null;
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

  // Get user location
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationError(null);
      },
      (err) => {
        setLocationError(`Location error: ${err.message}`);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

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
        description: `Geo: ${data.geofenceValidated ? '✅ Verified' : '❌ Failed'} | Face: ${data.faceVerified ? '✅ Verified' : '⚠️ Skipped'}`,
      });
    },
    onError: (err) => {
      setMarkingStep('select');
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  // Submit attendance
  const handleSubmit = () => {
    if (!currentUser || !selectedSession || !userLocation) return;
    setMarkingStep('submitting');
    markMutation.mutate({
      sessionId: selectedSession.id,
      studentId: currentUser.id,
      latitude: userLocation.lat,
      longitude: userLocation.lng,
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
                      requestLocation();
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
                <Button variant="outline" size="sm" className="text-xs h-7" onClick={requestLocation}>
                  <Navigation className="h-3 w-3 mr-1" /> Refresh Location
                </Button>
              </div>

              {/* Camera / Selfie */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Camera className="h-3.5 w-3.5" /> Selfie Capture (Optional)
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
                      <p className="text-muted-foreground mt-0.5">Selfie stored for audit — automated face matching is not configured</p>
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
                  disabled={!userLocation || markMutation.isPending}
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
                {!selfieBase64 && userLocation && (
                  <span className="text-xs text-muted-foreground">Selfie optional (face verification will be skipped)</span>
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
function AdminSessionsView() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [page, setPage] = useState(1);
  const limit = 20;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newSession, setNewSession] = useState({
    courseId: '', sessionDate: '', startTime: '09:00', endTime: '10:30',
    captureMethod: 'manual', geofenceId: '',
  });

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

  const { data: geofencesData } = useQuery<{ geofences: GeofenceOption[] }>({
    queryKey: ['geofences-list'],
    queryFn: () => fetch('/api/geofences').then(r => r.json()),
  });

  const courses = coursesData?.courses ?? [];
  const geofences = geofencesData?.geofences ?? [];
  const sessions = data?.sessions ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / limit));
  const hasActiveFilters = statusFilter !== 'all' || courseFilter !== 'all' || methodFilter !== 'all' || dateFilter !== undefined;

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch('/api/attendance/sessions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      }).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-sessions'] });
      setDialogOpen(false);
      toast({ title: 'Session Created', description: 'Attendance session created successfully.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create session.', variant: 'destructive' });
    },
  });

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
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: 'Session completed', description: 'Attendance summary anchored for audit trail.' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  return (
    <div className="space-y-4">
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
                  <div className="grid gap-1.5"><Label className="text-xs">Course *</Label><Select value={newSession.courseId} onValueChange={v => setNewSession(p => ({ ...p, courseId: v }))}><SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger><SelectContent>{courses.map(c => <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>)}</SelectContent></Select></div>
                  <div className="grid gap-1.5"><Label className="text-xs">Date *</Label><Input type="date" value={newSession.sessionDate} onChange={e => setNewSession(p => ({ ...p, sessionDate: e.target.value }))} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-1.5"><Label className="text-xs">Start</Label><Input type="time" value={newSession.startTime} onChange={e => setNewSession(p => ({ ...p, startTime: e.target.value }))} /></div>
                    <div className="grid gap-1.5"><Label className="text-xs">End</Label><Input type="time" value={newSession.endTime} onChange={e => setNewSession(p => ({ ...p, endTime: e.target.value }))} /></div>
                  </div>
                  <div className="grid gap-1.5"><Label className="text-xs">Capture Method</Label><Select value={newSession.captureMethod} onValueChange={v => setNewSession(p => ({ ...p, captureMethod: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(CAPTURE_METHOD_CONFIG).map(([k, { label }]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}</SelectContent></Select></div>
                  <div className="grid gap-1.5"><Label className="text-xs">Geofence</Label><Select value={newSession.geofenceId} onValueChange={v => setNewSession(p => ({ ...p, geofenceId: v }))}><SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger><SelectContent>{geofences.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent></Select></div>
                </div>
                <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button><Button onClick={() => createMutation.mutate({ courseId: newSession.courseId, sessionDate: newSession.sessionDate, startTime: newSession.startTime, endTime: newSession.endTime, captureMethod: newSession.captureMethod, geofenceId: newSession.geofenceId || undefined })} disabled={createMutation.isPending} className="bg-[#1A3C6E] hover:bg-[#1A3C6E]/90 text-white">{createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Create</Button></DialogFooter>
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
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────
export default function AttendanceSection() {
  const { currentUser } = useAppStore();
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
      ) : (
        <AdminSessionsView />
      )}
    </div>
  );
}
