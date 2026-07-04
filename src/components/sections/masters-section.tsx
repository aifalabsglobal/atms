'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from '@/lib/store';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Building2, GraduationCap, BookOpen, Calendar, Database,
  Plus, Pencil, Trash2, Loader2, Layers, Search, Rocket, Upload
} from 'lucide-react';
import { PublishSubjectDialog } from '@/components/lms/lms-dialogs';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

const NAVY = '#1A3C6E';

// ─── Shared Mutation Hook ────────────────────────────────────────────────────

function useMasterMutation(key: string, method: string, path: string) {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const url = method === 'DELETE' || method === 'PUT' ? `${path}?id=${body.id}` : path;
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method === 'DELETE' ? undefined : JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Operation failed');
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [key] });
      toast({ title: 'Success', description: `${key.replace('masters-', '').replace(/-/g, ' ')} saved successfully` });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });
}

// ─── Form Dialog Wrapper ─────────────────────────────────────────────────────

function FormDialog({
  title, description, open, onOpenChange, children, onSubmit, isLoading
}: {
  title: string; description: string; open: boolean; onOpenChange: (o: boolean) => void;
  children: React.ReactNode; onSubmit: () => void; isLoading: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">{children}</div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSubmit} disabled={isLoading} style={{ backgroundColor: NAVY }} className="text-white">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete Confirmation ─────────────────────────────────────────────────────

function DeleteConfirm({ onConfirm, isLoading }: { onConfirm: () => void; isLoading: boolean }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirm Delete</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete this record and may affect related data.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isLoading} className="bg-destructive text-destructive-foreground">
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ─── Departments Tab ─────────────────────────────────────────────────────────

function DepartmentsTab({ departments, readOnly }: { departments: any[]; readOnly?: boolean }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({ name: '', code: '', building: '', floor: '', phone: '', email: '', hodId: '' });

  const { data: hodData } = useQuery({
    queryKey: ['hod-candidates'],
    queryFn: () => fetch('/api/masters/hod-candidates').then(r => r.json()),
  });
  const hodCandidates = hodData?.candidates ?? [];

  const createMut = useMasterMutation('masters-departments', 'POST', '/api/masters/departments');
  const updateMut = useMasterMutation('masters-departments', 'PUT', '/api/masters/departments');
  const deleteMut = useMasterMutation('masters-departments', 'DELETE', '/api/masters/departments');

  const openNew = () => { setEditItem(null); setForm({ name: '', code: '', building: '', floor: '', phone: '', email: '', hodId: '' }); setDialogOpen(true); };
  const openEdit = (item: any) => { setEditItem(item); setForm({ name: item.name, code: item.code, building: item.building || '', floor: item.floor || '', phone: item.phone || '', email: item.email || '', hodId: item.hodId || '' }); setDialogOpen(true); };
  const handleSubmit = () => {
    const payload = { ...form, hodId: form.hodId || null };
    if (editItem) updateMut.mutate({ id: editItem.id, ...payload }, { onSuccess: () => setDialogOpen(false) });
    else createMut.mutate(payload, { onSuccess: () => setDialogOpen(false) });
  };
  const isLoading = createMut.isPending || updateMut.isPending;

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div><CardTitle className="text-lg">Departments</CardTitle><CardDescription>JNTUH Engineering College departments</CardDescription></div>
          {!readOnly && <Button size="sm" onClick={openNew} className="gap-1.5" style={{ backgroundColor: NAVY }}><Plus className="h-4 w-4" /> Add Department</Button>}
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-96">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Building</TableHead><TableHead>HOD</TableHead><TableHead>Programs</TableHead><TableHead>Subjects</TableHead><TableHead>Status</TableHead>{!readOnly && <TableHead className="w-20">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {departments.map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono font-semibold text-sm">{d.code}</TableCell>
                    <TableCell className="font-medium text-sm">{d.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{d.building || '-'}</TableCell>
                    <TableCell className="text-sm">{d.hod?.name || <span className="text-muted-foreground">Not assigned</span>}</TableCell>
                    <TableCell><Badge variant="secondary">{d._count?.programs || 0}</Badge></TableCell>
                    <TableCell><Badge variant="outline">{d._count?.subjects || 0}</Badge></TableCell>
                    <TableCell><Badge variant={d.isActive ? 'default' : 'destructive'} className="text-xs">{d.isActive ? 'Active' : 'Inactive'}</Badge></TableCell>
                    {!readOnly && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(d)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <DeleteConfirm onConfirm={() => deleteMut.mutate({ id: d.id })} isLoading={deleteMut.isPending} />
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
      <FormDialog title={editItem ? 'Edit Department' : 'Add Department'} description="Enter department details" open={dialogOpen} onOpenChange={setDialogOpen} onSubmit={handleSubmit} isLoading={isLoading}>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Computer Science & Engineering" /></div>
          <div><Label>Code</Label><Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="CSE" /></div>
          <div><Label>Building</Label><Input value={form.building} onChange={e => setForm(f => ({ ...f, building: e.target.value }))} placeholder="Block-A" /></div>
          <div><Label>Floor</Label><Input value={form.floor} onChange={e => setForm(f => ({ ...f, floor: e.target.value }))} placeholder="3rd Floor" /></div>
          <div><Label>Phone</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+91-40-23158665" /></div>
          <div><Label>Email</Label><Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="cse@jntuh.ac.in" /></div>
          <div className="col-span-2"><Label>HOD</Label>
            <Select value={form.hodId || '__none__'} onValueChange={v => setForm(f => ({ ...f, hodId: v === '__none__' ? '' : v }))}>
              <SelectTrigger><SelectValue placeholder="Assign HOD" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Not assigned</SelectItem>
                {hodCandidates.map((u: { id: string; name: string; role: string }) => (
                  <SelectItem key={u.id} value={u.id}>{u.name} ({u.role})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </FormDialog>
    </>
  );
}

// ─── Academic Years Tab ──────────────────────────────────────────────────────

function AcademicYearsTab({ academicYears, readOnly }: { academicYears: any[]; readOnly?: boolean }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({ name: '', code: '', startDate: '', endDate: '', regulation: '', status: 'upcoming' });

  const createMut = useMasterMutation('masters-academic-years', 'POST', '/api/masters/academic-years');
  const updateMut = useMasterMutation('masters-academic-years', 'PUT', '/api/masters/academic-years');
  const deleteMut = useMasterMutation('masters-academic-years', 'DELETE', '/api/masters/academic-years');

  const openNew = () => { setEditItem(null); setForm({ name: '', code: '', startDate: '', endDate: '', regulation: '', status: 'upcoming' }); setDialogOpen(true); };
  const openEdit = (item: any) => { setEditItem(item); setForm({ name: item.name, code: item.code, startDate: item.startDate, endDate: item.endDate, regulation: item.regulation || '', status: item.status }); setDialogOpen(true); };
  const handleSubmit = () => {
    if (editItem) updateMut.mutate({ id: editItem.id, ...form }, { onSuccess: () => setDialogOpen(false) });
    else createMut.mutate(form, { onSuccess: () => setDialogOpen(false) });
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div><CardTitle className="text-lg">Academic Years</CardTitle><CardDescription>Academic year configurations with regulation info</CardDescription></div>
          {!readOnly && <Button size="sm" onClick={openNew} className="gap-1.5" style={{ backgroundColor: NAVY }}><Plus className="h-4 w-4" /> Add Academic Year</Button>}
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-96">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Regulation</TableHead><TableHead>Start</TableHead><TableHead>End</TableHead><TableHead>Semesters</TableHead><TableHead>Status</TableHead>{!readOnly && <TableHead className="w-20">Actions</TableHead>}</TableRow>
              </TableHeader>
              <TableBody>
                {academicYears.map((ay: any) => (
                  <TableRow key={ay.id}>
                    <TableCell className="font-medium">{ay.name}</TableCell>
                    <TableCell className="font-mono text-sm">{ay.code}</TableCell>
                    <TableCell><Badge className="bg-[#1A3C6E] text-white text-xs">{ay.regulation || 'N/A'}</Badge></TableCell>
                    <TableCell className="text-sm">{ay.startDate}</TableCell>
                    <TableCell className="text-sm">{ay.endDate}</TableCell>
                    <TableCell><Badge variant="secondary">{ay._count?.semesters || 0}</Badge></TableCell>
                    <TableCell><Badge variant={ay.status === 'active' ? 'default' : ay.status === 'upcoming' ? 'secondary' : 'outline'} className="text-xs">{ay.status}</Badge></TableCell>
                    {!readOnly && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(ay)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <DeleteConfirm onConfirm={() => deleteMut.mutate({ id: ay.id })} isLoading={deleteMut.isPending} />
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
      <FormDialog title={editItem ? 'Edit Academic Year' : 'Add Academic Year'} description="Enter academic year details" open={dialogOpen} onOpenChange={setDialogOpen} onSubmit={handleSubmit} isLoading={createMut.isPending || updateMut.isPending}>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="2026-2027" /></div>
          <div><Label>Code</Label><Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="AY2627" /></div>
          <div><Label>Start Date</Label><Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} /></div>
          <div><Label>End Date</Label><Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} /></div>
          <div><Label>Regulation</Label><Input value={form.regulation} onChange={e => setForm(f => ({ ...f, regulation: e.target.value }))} placeholder="R22" /></div>
          <div><Label>Status</Label>
            <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="upcoming">Upcoming</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="completed">Completed</SelectItem></SelectContent>
            </Select>
          </div>
        </div>
      </FormDialog>
    </>
  );
}

// ─── Semesters Tab ───────────────────────────────────────────────────────────

function SemestersTab({ semesters, academicYears, readOnly }: { semesters: any[]; academicYears: any[]; readOnly?: boolean }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({ academicYearId: '', name: '', code: '', year: '1', semester: '1', startDate: '', endDate: '', status: 'upcoming' });

  const createMut = useMasterMutation('masters-semesters', 'POST', '/api/masters/semesters');
  const updateMut = useMasterMutation('masters-semesters', 'PUT', '/api/masters/semesters');
  const deleteMut = useMasterMutation('masters-semesters', 'DELETE', '/api/masters/semesters');

  const openNew = () => { setEditItem(null); setForm({ academicYearId: academicYears[0]?.id || '', name: '', code: '', year: '1', semester: '1', startDate: '', endDate: '', status: 'upcoming' }); setDialogOpen(true); };
  const openEdit = (item: any) => { setEditItem(item); setForm({ academicYearId: item.academicYearId, name: item.name, code: item.code, year: String(item.year), semester: String(item.semester), startDate: item.startDate, endDate: item.endDate, status: item.status }); setDialogOpen(true); };
  const handleSubmit = () => {
    const payload = { ...form, year: parseInt(form.year), semester: parseInt(form.semester) };
    if (editItem) updateMut.mutate({ id: editItem.id, ...payload }, { onSuccess: () => setDialogOpen(false) });
    else createMut.mutate(payload, { onSuccess: () => setDialogOpen(false) });
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div><CardTitle className="text-lg">Semesters</CardTitle><CardDescription>4-year B.Tech program semesters</CardDescription></div>
          {!readOnly && <Button size="sm" onClick={openNew} className="gap-1.5" style={{ backgroundColor: NAVY }}><Plus className="h-4 w-4" /> Add Semester</Button>}
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-96">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Year</TableHead><TableHead>Sem</TableHead><TableHead>Academic Year</TableHead><TableHead>Start</TableHead><TableHead>End</TableHead><TableHead>Subjects</TableHead><TableHead>Status</TableHead>{!readOnly && <TableHead className="w-20">Actions</TableHead>}</TableRow>
              </TableHeader>
              <TableBody>
                {semesters.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono font-semibold text-sm">{s.code}</TableCell>
                    <TableCell className="font-medium text-sm">{s.name}</TableCell>
                    <TableCell className="text-center">{s.year}</TableCell>
                    <TableCell className="text-center">{s.semester}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.academicYear?.name || '-'}</TableCell>
                    <TableCell className="text-sm">{s.startDate}</TableCell>
                    <TableCell className="text-sm">{s.endDate}</TableCell>
                    <TableCell><Badge variant="secondary">{s._count?.subjects || 0}</Badge></TableCell>
                    <TableCell><Badge variant={s.status === 'active' ? 'default' : 'secondary'} className="text-xs">{s.status}</Badge></TableCell>
                    {!readOnly && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <DeleteConfirm onConfirm={() => deleteMut.mutate({ id: s.id })} isLoading={deleteMut.isPending} />
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
      <FormDialog title={editItem ? 'Edit Semester' : 'Add Semester'} description="Enter semester details" open={dialogOpen} onOpenChange={setDialogOpen} onSubmit={handleSubmit} isLoading={createMut.isPending || updateMut.isPending}>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label>Academic Year</Label>
            <Select value={form.academicYearId} onValueChange={v => setForm(f => ({ ...f, academicYearId: v }))}>
              <SelectTrigger><SelectValue placeholder="Select academic year" /></SelectTrigger>
              <SelectContent>{academicYears.map((ay: any) => <SelectItem key={ay.id} value={ay.id}>{ay.name} ({ay.regulation})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="I Year I Sem" /></div>
          <div><Label>Code</Label><Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="I-I" /></div>
          <div><Label>Year</Label>
            <Select value={form.year} onValueChange={v => setForm(f => ({ ...f, year: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{[1,2,3,4].map(y => <SelectItem key={y} value={String(y)}>Year {y}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Semester</Label>
            <Select value={form.semester} onValueChange={v => setForm(f => ({ ...f, semester: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="1">Semester 1</SelectItem><SelectItem value="2">Semester 2</SelectItem></SelectContent>
            </Select>
          </div>
          <div><Label>Start Date</Label><Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} /></div>
          <div><Label>End Date</Label><Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} /></div>
          <div><Label>Status</Label>
            <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="upcoming">Upcoming</SelectItem><SelectItem value="active">Active</SelectItem><SelectItem value="completed">Completed</SelectItem></SelectContent>
            </Select>
          </div>
        </div>
      </FormDialog>
    </>
  );
}

// ─── JNTU Import Dialog ──────────────────────────────────────────────────────

function JntuImportDialog({ open, onOpenChange, departments, programs }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  departments: { id: string; code: string; name: string }[];
  programs: { id: string; code: string; name: string; departmentId: string }[];
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [jsonText, setJsonText] = useState('');
  const [updateExisting, setUpdateExisting] = useState(true);
  const [publishToLms, setPublishToLms] = useState(false);
  const [programId, setProgramId] = useState('');
  const [catalog, setCatalog] = useState<'r22-cse' | 'r22-ece'>('r22-cse');
  const [departmentId, setDepartmentId] = useState('');
  const [result, setResult] = useState<{
    created: number; updated: number; skipped: number; errors: number;
    publishedCourses?: number;
    results?: { code: string; status: string; message?: string }[];
  } | null>(null);

  useEffect(() => {
    if (open && departments.length && !departmentId) {
      const cse = departments.find((d) => d.code === 'CSE');
      setDepartmentId(cse?.id || departments[0].id);
    }
  }, [open, departments, departmentId]);

  useEffect(() => {
    const deptPrograms = programs.filter((p) => p.departmentId === departmentId);
    if (programId && !deptPrograms.some((p) => p.id === programId)) {
      setProgramId(deptPrograms[0]?.id || '');
    } else if (!programId && deptPrograms[0]) {
      setProgramId(deptPrograms[0].id);
    }
  }, [departmentId, programs, programId]);

  const deptPrograms = programs.filter((p) => p.departmentId === departmentId);

  const importMut = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch('/api/masters/subjects/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      return data;
    },
    onSuccess: (data) => {
      setResult({
        created: data.created,
        updated: data.updated,
        skipped: data.skipped,
        errors: data.errors,
        publishedCourses: data.publishedCourses,
        results: data.results,
      });
      qc.invalidateQueries({ queryKey: ['masters-subjects'] });
      qc.invalidateQueries({ queryKey: ['lms-courses'] });
      const pub = data.publishedCourses ? ` · ${data.publishedCourses} LMS course(s) published` : '';
      toast({
        title: 'Import complete',
        description: `${data.created} created, ${data.updated} updated, ${data.skipped} skipped, ${data.errors} errors${pub}`,
      });
    },
    onError: (e: Error) => toast({ title: 'Import failed', description: e.message, variant: 'destructive' }),
  });

  const importPayload = () => ({
    departmentId,
    updateExisting,
    ...(publishToLms ? { publishToLms: true, programId } : {}),
  });

  const importBundled = () => {
    if (!departmentId) {
      toast({ title: 'Select a department', variant: 'destructive' });
      return;
    }
    if (publishToLms && !programId) {
      toast({ title: 'Select a program', description: 'Required when auto-publishing to LMS', variant: 'destructive' });
      return;
    }
    importMut.mutate({ catalog, ...importPayload() });
  };

  const importCustom = () => {
    try {
      const parsed = JSON.parse(jsonText);
      const subjects = Array.isArray(parsed) ? parsed : parsed.subjects;
      if (!Array.isArray(subjects) || subjects.length === 0) {
        toast({ title: 'Invalid JSON', description: 'Expected { subjects: [...] } or an array', variant: 'destructive' });
        return;
      }
      if (publishToLms && !programId) {
        toast({ title: 'Select a program', description: 'Required when auto-publishing to LMS', variant: 'destructive' });
        return;
      }
      importMut.mutate({
        subjects,
        departmentCode: parsed.departmentCode,
        ...importPayload(),
      });
    } catch {
      toast({ title: 'Invalid JSON', description: 'Could not parse file content', variant: 'destructive' });
    }
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setJsonText(String(reader.result || ''));
    reader.readAsText(file);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setResult(null); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import JNTU Subjects</DialogTitle>
          <DialogDescription>Import R22 subjects into any department — share catalogs across colleges</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs">Target department</Label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="Select department" /></SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.code} — {d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="rounded-lg border p-3 space-y-2">
            <p className="text-sm font-medium">Bundled catalogs</p>
            <Select value={catalog} onValueChange={(v) => setCatalog(v as 'r22-cse' | 'r22-ece')}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="r22-cse">R22 B.Tech CSE (52 subjects)</SelectItem>
                <SelectItem value="r22-ece">R22 B.Tech ECE (8 subjects)</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={importBundled} disabled={importMut.isPending || !departmentId} style={{ backgroundColor: NAVY }} className="text-white w-full">
              {importMut.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Import into selected department
            </Button>
          </div>
          <div className="relative"><div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div><div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">or custom JSON</span></div></div>
          <div>
            <Label className="text-xs">Upload JSON file</Label>
            <Input type="file" accept=".json,application/json" className="mt-1 h-9" onChange={onFile} />
          </div>
          <div>
            <Label className="text-xs">Or paste JSON</Label>
            <Textarea rows={5} className="mt-1 font-mono text-xs" placeholder='{ "departmentCode": "CSE", "subjects": [{ "code": "CS301PC", ... }] }' value={jsonText} onChange={e => setJsonText(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={updateExisting} onChange={e => setUpdateExisting(e.target.checked)} />
            Update existing subjects (match by code)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={publishToLms} onChange={e => setPublishToLms(e.target.checked)} />
            Auto-publish imported subjects as LMS courses
          </label>
          {publishToLms && (
            <div>
              <Label className="text-xs">Target program</Label>
              <Select value={programId} onValueChange={setProgramId}>
                <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="Select program" /></SelectTrigger>
                <SelectContent>
                  {deptPrograms.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.code} — {p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {result && (
            <div className="text-xs rounded-md bg-muted p-2 grid grid-cols-4 gap-2 text-center">
              <div><span className="font-bold text-emerald-600">{result.created}</span><br />Created</div>
              <div><span className="font-bold text-blue-600">{result.updated}</span><br />Updated</div>
              <div><span className="font-bold text-amber-600">{result.skipped}</span><br />Skipped</div>
              <div><span className="font-bold text-destructive">{result.errors}</span><br />Errors</div>
              {result.publishedCourses !== undefined && result.publishedCourses > 0 && (
                <div className="col-span-4 text-emerald-700">{result.publishedCourses} LMS course(s) published</div>
              )}
              {result.results && result.results.filter((r) => r.status === 'error').length > 0 && (
                <div className="col-span-4 text-left max-h-32 overflow-y-auto space-y-0.5 border-t pt-2 mt-1">
                  <p className="font-semibold text-destructive">Failed rows</p>
                  {result.results.filter((r) => r.status === 'error').slice(0, 20).map((r) => (
                    <p key={r.code} className="text-[10px] font-mono text-destructive">{r.code}: {r.message}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={importCustom} disabled={!jsonText.trim() || importMut.isPending}>Import Custom JSON</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Subjects Tab ────────────────────────────────────────────────────────────

function SubjectsTab({ subjects, departments, semesters, programs, readOnly }: { subjects: any[]; departments: any[]; semesters: any[]; programs: { id: string; code: string; name: string; departmentId: string }[]; readOnly?: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishSubject, setPublishSubject] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({ code: '', name: '', departmentId: '', semesterId: '', credits: '3', lectureHours: '3', tutorialHours: '0', labHours: '0', type: 'core', category: '', syllabus: '', textbooks: '', referenceBooks: '' });

  const createMut = useMasterMutation('masters-subjects', 'POST', '/api/masters/subjects');
  const deleteMut = useMasterMutation('masters-subjects', 'DELETE', '/api/masters/subjects');

  const openNew = () => { setEditItem(null); setForm({ code: '', name: '', departmentId: departments[0]?.id || '', semesterId: semesters[0]?.id || '', credits: '3', lectureHours: '3', tutorialHours: '0', labHours: '0', type: 'core', category: '', syllabus: '', textbooks: '', referenceBooks: '' }); setDialogOpen(true); };
  const openEdit = (item: any) => { setEditItem(item); setForm({ code: item.code, name: item.name, departmentId: item.departmentId, semesterId: item.semesterId || '', credits: String(item.credits), lectureHours: String(item.lectureHours), tutorialHours: String(item.tutorialHours), labHours: String(item.labHours), type: item.type, category: item.category || '', syllabus: item.syllabus || '', textbooks: item.textbooks || '', referenceBooks: item.referenceBooks || '' }); setDialogOpen(true); };
  const handleSubmit = async () => {
    const payload = { ...form, credits: parseInt(form.credits), lectureHours: parseInt(form.lectureHours), tutorialHours: parseInt(form.tutorialHours), labHours: parseInt(form.labHours) };
    if (editItem) {
      try {
        const res = await fetch(`/api/masters/subjects?id=${editItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Update failed');
        qc.invalidateQueries({ queryKey: ['masters-subjects'] });
        qc.invalidateQueries({ queryKey: ['lms-courses'] });
        setDialogOpen(false);
        let desc = 'Subject saved successfully';
        if (data.syncedCourses > 0) desc += ` · ${data.syncedCourses} linked course(s) synced`;
        if (data.syncError) desc += ` · Sync warning: ${data.syncError}`;
        toast({ title: 'Success', description: desc, variant: data.syncError ? 'destructive' : 'default' });
      } catch (e) {
        toast({ title: 'Error', description: e instanceof Error ? e.message : 'Update failed', variant: 'destructive' });
      }
    } else {
      createMut.mutate(payload, { onSuccess: () => setDialogOpen(false) });
    }
  };

  const filtered = subjects.filter((s: any) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return s.code.toLowerCase().includes(q) || s.name.toLowerCase().includes(q);
  });

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div><CardTitle className="text-lg">Subjects (JNTU R22)</CardTitle><CardDescription>Course subjects as per JNTUH R22 B.Tech curriculum</CardDescription></div>
          <div className="flex gap-2">
            {!readOnly && (
              <>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setImportOpen(true)}>
                  <Upload className="h-4 w-4" /> Import
                </Button>
                <Button size="sm" onClick={openNew} className="gap-1.5" style={{ backgroundColor: NAVY }}><Plus className="h-4 w-4" /> Add Subject</Button>
              </>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative mb-3 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search subjects..." className="pl-9 h-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <ScrollArea className="max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Dept</TableHead><TableHead>Sem</TableHead><TableHead>Credits</TableHead><TableHead>L-T-P</TableHead><TableHead>Courses</TableHead><TableHead>Type</TableHead>{!readOnly && <TableHead className="w-24">Actions</TableHead>}</TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono font-semibold text-xs">{s.code}</TableCell>
                    <TableCell className="font-medium text-sm max-w-[200px] truncate">{s.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{s.department?.code || '-'}</TableCell>
                    <TableCell className="text-xs">{s.semester?.code || '-'}</TableCell>
                    <TableCell className="text-center">{s.credits}</TableCell>
                    <TableCell className="text-xs font-mono">{s.lectureHours}-{s.tutorialHours}-{s.labHours}</TableCell>
                    <TableCell><Badge variant="outline">{s._count?.courses ?? 0}</Badge></TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{s.type === 'professional_elective' ? 'PE' : s.type === 'open_elective' ? 'OE' : s.type}</Badge></TableCell>
                    {!readOnly && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" title="Publish to LMS" onClick={() => { setPublishSubject(s); setPublishOpen(true); }}>
                            <Rocket className="h-3.5 w-3.5 text-[#1A3C6E]" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <DeleteConfirm onConfirm={() => deleteMut.mutate({ id: s.id })} isLoading={deleteMut.isPending} />
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
      <FormDialog title={editItem ? 'Edit Subject' : 'Add Subject'} description={editItem ? 'Changes sync to linked LMS courses automatically' : 'Enter subject details (JNTU R22 pattern)'} open={dialogOpen} onOpenChange={setDialogOpen} onSubmit={handleSubmit} isLoading={createMut.isPending}>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Code</Label><Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="CS301PC" /></div>
          <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Computer Organization" /></div>
          <div><Label>Department</Label>
            <Select value={form.departmentId} onValueChange={v => setForm(f => ({ ...f, departmentId: v }))}>
              <SelectTrigger><SelectValue placeholder="Select dept" /></SelectTrigger>
              <SelectContent>{departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.code} - {d.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Semester</Label>
            <Select value={form.semesterId} onValueChange={v => setForm(f => ({ ...f, semesterId: v }))}>
              <SelectTrigger><SelectValue placeholder="Select semester" /></SelectTrigger>
              <SelectContent><SelectItem value="">None</SelectItem>{semesters.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.code} - {s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Credits</Label><Input type="number" value={form.credits} onChange={e => setForm(f => ({ ...f, credits: e.target.value }))} /></div>
          <div><Label>L-T-P Hours</Label><div className="flex gap-1"><Input type="number" value={form.lectureHours} onChange={e => setForm(f => ({ ...f, lectureHours: e.target.value }))} className="w-16" /><Input type="number" value={form.tutorialHours} onChange={e => setForm(f => ({ ...f, tutorialHours: e.target.value }))} className="w-16" /><Input type="number" value={form.labHours} onChange={e => setForm(f => ({ ...f, labHours: e.target.value }))} className="w-16" /></div></div>
          <div><Label>Type</Label>
            <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="core">Core</SelectItem><SelectItem value="elective">Elective</SelectItem><SelectItem value="lab">Lab</SelectItem><SelectItem value="audit">Audit</SelectItem><SelectItem value="professional_elective">Prof. Elective</SelectItem><SelectItem value="open_elective">Open Elective</SelectItem><SelectItem value="project">Project</SelectItem></SelectContent>
            </Select>
          </div>
          <div><Label>Category</Label>
            <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent><SelectItem value="">None</SelectItem><SelectItem value="BS">BS (Basic Sciences)</SelectItem><SelectItem value="ES">ES (Engineering Sciences)</SelectItem><SelectItem value="PC">PC (Professional Core)</SelectItem><SelectItem value="PE">PE (Professional Elective)</SelectItem><SelectItem value="OE">OE (Open Elective)</SelectItem><SelectItem value="HS">HS (Humanities & Social)</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="col-span-2"><Label>Syllabus</Label><Textarea rows={4} value={form.syllabus} onChange={e => setForm(f => ({ ...f, syllabus: e.target.value }))} placeholder="Syllabus outline..." /></div>
        </div>
      </FormDialog>
      <PublishSubjectDialog open={publishOpen} onOpenChange={setPublishOpen} subject={publishSubject} />
      <JntuImportDialog open={importOpen} onOpenChange={setImportOpen} departments={departments} programs={programs} />
    </>
  );
}

// ─── Programs Tab ────────────────────────────────────────────────────────────

function ProgramsTab({ programs, departments, readOnly }: { programs: any[]; departments: any[]; readOnly?: boolean }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [form, setForm] = useState({ name: '', code: '', departmentId: '', duration: '4', type: 'ug', description: '' });

  const createMut = useMasterMutation('masters-programs', 'POST', '/api/masters/programs');
  const updateMut = useMasterMutation('masters-programs', 'PUT', '/api/masters/programs');
  const deleteMut = useMasterMutation('masters-programs', 'DELETE', '/api/masters/programs');

  const openNew = () => { setEditItem(null); setForm({ name: '', code: '', departmentId: departments[0]?.id || '', duration: '4', type: 'ug', description: '' }); setDialogOpen(true); };
  const openEdit = (item: any) => { setEditItem(item); setForm({ name: item.name, code: item.code, departmentId: item.departmentId, duration: String(item.duration), type: item.type, description: item.description || '' }); setDialogOpen(true); };
  const handleSubmit = () => {
    const payload = { ...form, duration: parseInt(form.duration) };
    if (editItem) updateMut.mutate({ id: editItem.id, ...payload }, { onSuccess: () => setDialogOpen(false) });
    else createMut.mutate(payload, { onSuccess: () => setDialogOpen(false) });
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div><CardTitle className="text-lg">Programs</CardTitle><CardDescription>B.Tech programs offered by JNTUH Engineering College</CardDescription></div>
          {!readOnly && <Button size="sm" onClick={openNew} className="gap-1.5" style={{ backgroundColor: NAVY }}><Plus className="h-4 w-4" /> Add Program</Button>}
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-96">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Code</TableHead><TableHead>Name</TableHead><TableHead>Department</TableHead><TableHead>Duration</TableHead><TableHead>Type</TableHead><TableHead>Courses</TableHead><TableHead>Status</TableHead>{!readOnly && <TableHead className="w-20">Actions</TableHead>}</TableRow>
              </TableHeader>
              <TableBody>
                {programs.map((p: any) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono font-semibold text-sm">{p.code}</TableCell>
                    <TableCell className="font-medium text-sm">{p.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{p.department?.code || '-'}</TableCell>
                    <TableCell className="text-center">{p.duration} yrs</TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs uppercase">{p.type}</Badge></TableCell>
                    <TableCell><Badge variant="outline">{p._count?.courses || 0}</Badge></TableCell>
                    <TableCell><Badge variant={p.isActive ? 'default' : 'destructive'} className="text-xs">{p.isActive ? 'Active' : 'Inactive'}</Badge></TableCell>
                    {!readOnly && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                          <DeleteConfirm onConfirm={() => deleteMut.mutate({ id: p.id })} isLoading={deleteMut.isPending} />
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>
      <FormDialog title={editItem ? 'Edit Program' : 'Add Program'} description="Enter program details" open={dialogOpen} onOpenChange={setDialogOpen} onSubmit={handleSubmit} isLoading={createMut.isPending || updateMut.isPending}>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Name</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="B.Tech CSE" /></div>
          <div><Label>Code</Label><Input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="BT-CSE" /></div>
          <div><Label>Department</Label>
            <Select value={form.departmentId} onValueChange={v => setForm(f => ({ ...f, departmentId: v }))}>
              <SelectTrigger><SelectValue placeholder="Select dept" /></SelectTrigger>
              <SelectContent>{departments.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.code} - {d.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Duration (years)</Label><Input type="number" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} /></div>
          <div><Label>Type</Label>
            <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="ug">UG</SelectItem><SelectItem value="pg">PG</SelectItem><SelectItem value="phd">Ph.D</SelectItem><SelectItem value="diploma">Diploma</SelectItem></SelectContent>
            </Select>
          </div>
          <div><Label>Description</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="4-year undergraduate program" /></div>
        </div>
      </FormDialog>
    </>
  );
}

// ─── Main Masters Section ────────────────────────────────────────────────────

export default function MastersSection() {
  const { currentUser } = useAppStore();
  const { data: deptsData, isLoading: dL } = useQuery({ queryKey: ['masters-departments'], queryFn: () => fetch('/api/masters/departments?limit=50').then(r => r.json()) });
  const { data: ayData, isLoading: ayL } = useQuery({ queryKey: ['masters-academic-years'], queryFn: () => fetch('/api/masters/academic-years?limit=50').then(r => r.json()) });
  const { data: semData, isLoading: semL } = useQuery({ queryKey: ['masters-semesters'], queryFn: () => fetch('/api/masters/semesters?limit=50').then(r => r.json()) });
  const { data: subjData, isLoading: subjL } = useQuery({ queryKey: ['masters-subjects'], queryFn: () => fetch('/api/masters/subjects?limit=200').then(r => r.json()) });
  const { data: progData, isLoading: progL } = useQuery({ queryKey: ['masters-programs'], queryFn: () => fetch('/api/masters/programs?limit=50').then(r => r.json()) });

  const departments = deptsData?.departments || [];
  const academicYears = ayData?.academicYears || [];
  const semesters = semData?.semesters || [];
  const subjects = subjData?.subjects || [];
  const programs = progData?.programs || [];

  const isLoading = dL || ayL || semL || subjL || progL;

  if (!currentUser) return null;

  const mastersReadOnly = currentUser.role === 'hod';

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" style={{ color: NAVY }}>
            <Database className="h-6 w-6" /> Masters Data Management
            {mastersReadOnly && <Badge variant="secondary" className="text-xs font-normal">Read-only (dept scope)</Badge>}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mastersReadOnly
              ? 'View department-scoped masters data (JNTUH R22 Regulation)'
              : 'Create and manage departments, academic years, semesters, subjects & programs (JNTUH R22 Regulation)'}
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { icon: Building2, label: 'Departments', value: departments.length, color: NAVY },
          { icon: Calendar, label: 'Academic Years', value: academicYears.length, color: '#16a34a' },
          { icon: Layers, label: 'Semesters', value: semesters.length, color: '#7c3aed' },
          { icon: BookOpen, label: 'Subjects', value: subjects.length, color: '#ea580c' },
          { icon: GraduationCap, label: 'Programs', value: programs.length, color: '#0891b2' },
        ].map(s => (
          <Card key={s.label} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${s.color}12` }}>
                <s.icon className="h-5 w-5" style={{ color: s.color }} />
              </div>
              <div>
                <p className="text-2xl font-bold">{isLoading ? '...' : s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabbed Content */}
      <Tabs defaultValue="departments" className="w-full">
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="departments" className="text-xs sm:text-sm">Departments</TabsTrigger>
          <TabsTrigger value="academic-years" className="text-xs sm:text-sm">Acad. Years</TabsTrigger>
          <TabsTrigger value="semesters" className="text-xs sm:text-sm">Semesters</TabsTrigger>
          <TabsTrigger value="subjects" className="text-xs sm:text-sm">Subjects</TabsTrigger>
          <TabsTrigger value="programs" className="text-xs sm:text-sm">Programs</TabsTrigger>
        </TabsList>
        <TabsContent value="departments" className="mt-4"><DepartmentsTab departments={departments} readOnly={mastersReadOnly} /></TabsContent>
        <TabsContent value="academic-years" className="mt-4"><AcademicYearsTab academicYears={academicYears} readOnly={mastersReadOnly} /></TabsContent>
        <TabsContent value="semesters" className="mt-4"><SemestersTab semesters={semesters} academicYears={academicYears} readOnly={mastersReadOnly} /></TabsContent>
        <TabsContent value="subjects" className="mt-4"><SubjectsTab subjects={subjects} departments={departments} semesters={semesters} programs={programs} readOnly={mastersReadOnly} /></TabsContent>
        <TabsContent value="programs" className="mt-4"><ProgramsTab programs={programs} departments={departments} readOnly={mastersReadOnly} /></TabsContent>
      </Tabs>
    </div>
  );
}
