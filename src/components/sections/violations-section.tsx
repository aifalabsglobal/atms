'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ShieldAlert, AlertTriangle, Eye, CheckCircle, XCircle, Clock, MapPin, ScanFace, Filter } from 'lucide-react';
import { useState } from 'react';
import type { ViolationItem } from '@/lib/types';
import { useAppStore } from '@/lib/store';

const severityColors: Record<string, string> = { low: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200', medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200', high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200', critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' };
const statusColors: Record<string, string> = { pending: 'bg-amber-100 text-amber-800', confirmed: 'bg-red-100 text-red-800', dismissed: 'bg-green-100 text-green-800' };
const typeIcons: Record<string, React.ElementType> = { spoofing: AlertTriangle, proxy: ShieldAlert, out_of_geofence: MapPin, multiple_marking: Clock, face_mismatch: ScanFace };

export default function ViolationsSection() {
  const { currentUser } = useAppStore();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedViolation, setSelectedViolation] = useState<ViolationItem | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['violations', statusFilter, severityFilter, typeFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.set('reviewStatus', statusFilter);
      if (severityFilter !== 'all') params.set('severity', severityFilter);
      if (typeFilter !== 'all') params.set('type', typeFilter);
      const res = await fetch(`/api/attendance/violations?${params}`);
      return res.json() as Promise<{ violations: ViolationItem[]; total: number }>;
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, reviewStatus, reviewNotes }: { id: string; reviewStatus: string; reviewNotes: string }) => {
      const res = await fetch('/api/attendance/violations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, reviewStatus, reviewNotes }),
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['violations'] });
      setSelectedViolation(null);
      setReviewNotes('');
    },
  });

  const violations = data?.violations || [];
  const pendingCount = violations.filter(v => v.reviewStatus === 'pending').length;
  const confirmedCount = violations.filter(v => v.reviewStatus === 'confirmed').length;
  const dismissedCount = violations.filter(v => v.reviewStatus === 'dismissed').length;

  if (!currentUser) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand">Attendance Violations</h1>
          <p className="text-sm text-muted-foreground mt-1">Review and manage attendance policy violations</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />{pendingCount} Pending</Badge>
          <Badge variant="secondary" className="gap-1"><CheckCircle className="h-3 w-3" />{confirmedCount} Confirmed</Badge>
          <Badge variant="outline" className="gap-1"><XCircle className="h-3 w-3" />{dismissedCount} Dismissed</Badge>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Severity" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Severity</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="spoofing">Spoofing</SelectItem>
            <SelectItem value="proxy">Proxy</SelectItem>
            <SelectItem value="out_of_geofence">Out of Geofence</SelectItem>
            <SelectItem value="face_mismatch">Face Mismatch</SelectItem>
            <SelectItem value="multiple_marking">Multiple Marking</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Violations Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading violations...</div>
          ) : violations.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">No violations found</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {violations.map(v => {
                    const TypeIcon = typeIcons[v.type] || AlertTriangle;
                    return (
                      <TableRow key={v.id} className="cursor-pointer hover:bg-muted/50" onClick={() => { setSelectedViolation(v); setReviewNotes(v.reviewNotes || ''); }}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <TypeIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium capitalize">{v.type.replace(/_/g, ' ')}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{v.violator.name}</p>
                            <p className="text-xs text-muted-foreground">{v.violator.employeeId} • {v.violator.department}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{v.record?.session?.course?.name || '-'}</TableCell>
                        <TableCell>
                          <Badge className={severityColors[v.severity]} variant="secondary">{v.severity}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[v.reviewStatus]} variant="secondary">{v.reviewStatus}</Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{v.record?.session?.sessionDate || '-'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{v.description}</TableCell>
                        <TableCell className="text-right">
                          {v.reviewStatus === 'pending' && (
                            <Button size="sm" variant="outline" className="h-7 gap-1" onClick={(e) => { e.stopPropagation(); setSelectedViolation(v); setReviewNotes(''); }}>
                              <Eye className="h-3 w-3" /> Review
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      <Dialog open={!!selectedViolation} onOpenChange={() => setSelectedViolation(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-brand">Review Violation</DialogTitle>
          </DialogHeader>
          {selectedViolation && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">Type:</span> <span className="font-medium capitalize">{selectedViolation.type.replace(/_/g, ' ')}</span></div>
                <div><span className="text-muted-foreground">Severity:</span> <Badge className={severityColors[selectedViolation.severity]} variant="secondary">{selectedViolation.severity}</Badge></div>
                <div><span className="text-muted-foreground">Student:</span> <span className="font-medium">{selectedViolation.violator.name}</span></div>
                <div><span className="text-muted-foreground">Department:</span> <span>{selectedViolation.violator.department}</span></div>
                <div><span className="text-muted-foreground">Course:</span> <span>{selectedViolation.record?.session?.course?.name}</span></div>
                <div><span className="text-muted-foreground">Date:</span> <span>{selectedViolation.record?.session?.sessionDate}</span></div>
              </div>
              <Separator />
              <div>
                <span className="text-sm text-muted-foreground">Description:</span>
                <p className="text-sm mt-1">{selectedViolation.description}</p>
              </div>
              {selectedViolation.reviewer && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Reviewed by:</span> <span className="font-medium">{selectedViolation.reviewer.name}</span>
                  {selectedViolation.reviewNotes && <p className="mt-1 text-muted-foreground">&ldquo;{selectedViolation.reviewNotes}&rdquo;</p>}
                </div>
              )}
              {selectedViolation.reviewStatus === 'pending' && (
                <>
                  <div>
                    <label className="text-sm font-medium">Review Notes</label>
                    <Textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="Add review notes..." className="mt-1" rows={3} />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setSelectedViolation(null)}>Cancel</Button>
                    <Button variant="destructive" onClick={() => reviewMutation.mutate({ id: selectedViolation.id, reviewStatus: 'confirmed', reviewNotes })}>
                      Confirm Violation
                    </Button>
                    <Button variant="default" className="bg-green-600 hover:bg-green-700" onClick={() => reviewMutation.mutate({ id: selectedViolation.id, reviewStatus: 'dismissed', reviewNotes })}>
                      Dismiss
                    </Button>
                  </DialogFooter>
                </>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
