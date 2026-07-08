'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Plus, Send, Trash2, Play, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { CodingProblemMeta } from '@/lib/coding-types';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { Role } from '@/lib/store';
import { BUNDLED_CODING_PROBLEMS } from '@/data/leetcode-problems';

const NAVY = '#1A3C6E';

type InstructorCandidate = {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string | null;
  employeeId: string | null;
};

function useInstructorCandidates(open: boolean, departmentId?: string | null, enabled = true) {
  return useQuery({
    queryKey: ['lms-instructor-candidates', departmentId ?? 'all'],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (departmentId) params.set('departmentId', departmentId);
      const res = await fetch(`/api/lms/instructor-candidates?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load instructors');
      return data as { candidates: InstructorCandidate[] };
    },
    enabled: open && enabled,
  });
}

function InstructorSelectField({
  value,
  onChange,
  departmentId,
  open,
  label = 'Instructor',
  description,
}: {
  value: string;
  onChange: (id: string) => void;
  departmentId?: string | null;
  open: boolean;
  label?: string;
  description?: string;
}) {
  const { data, isLoading } = useInstructorCandidates(open, departmentId);
  const candidates = data?.candidates ?? [];

  return (
    <div>
      <Label>{label}</Label>
      {description && <p className="text-[11px] text-muted-foreground mt-0.5 mb-1">{description}</p>}
      <Select value={value || '__none__'} onValueChange={(v) => onChange(v === '__none__' ? '' : v)}>
        <SelectTrigger><SelectValue placeholder={isLoading ? 'Loading…' : 'Select instructor'} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">Unassigned (TBA)</SelectItem>
          {candidates.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name} — {c.role === 'lab_assistant' ? 'Lab Asst' : 'Faculty'}
              {c.department ? ` · ${c.department}` : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function CreateCourseDialog({
  open, onOpenChange, role,
}: { open: boolean; onOpenChange: (o: boolean) => void; role: Role }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({ programId: '', subjectId: '', code: '', name: '', instructorId: '' });

  const { data: programsData } = useQuery({
    queryKey: ['masters-programs-picker'],
    queryFn: () => fetch('/api/masters/programs?limit=50').then((r) => r.json()),
    enabled: open && (role === 'super_admin' || role === 'admin'),
  });
  const { data: subjectsData } = useQuery({
    queryKey: ['masters-subjects-picker'],
    queryFn: () => fetch('/api/masters/subjects?limit=200').then((r) => r.json()),
    enabled: open,
  });

  const programs = programsData?.programs ?? [];
  const subjects = subjectsData?.subjects ?? [];
  const isAdmin = role === 'super_admin' || role === 'admin';
  const selectedProgram = programs.find((p: { id: string }) => p.id === form.programId) as
    | { id: string; departmentId?: string; department?: { id: string } }
    | undefined;
  const programDepartmentId = selectedProgram?.departmentId ?? selectedProgram?.department?.id;

  useEffect(() => {
    if (!open) setForm({ programId: '', subjectId: '', code: '', name: '', instructorId: '' });
  }, [open]);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/lms/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          programId: form.programId,
          subjectId: form.subjectId || undefined,
          code: form.code || undefined,
          name: form.name || undefined,
          instructorId: form.instructorId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lms-courses'] });
      toast({ title: 'Course created' });
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Course</DialogTitle>
          <DialogDescription>Link a program and optional masters subject to offer an LMS course.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Program</Label>
            <Select value={form.programId} onValueChange={(v) => setForm((f) => ({ ...f, programId: v }))}>
              <SelectTrigger><SelectValue placeholder="Select program" /></SelectTrigger>
              <SelectContent>
                {programs.map((p: { id: string; code: string; name: string }) => (
                  <SelectItem key={p.id} value={p.id}>{p.code} — {p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Subject (optional — auto-fills from masters)</Label>
            <Select value={form.subjectId} onValueChange={(v) => {
              const sub = subjects.find((s: { id: string }) => s.id === v);
              setForm((f) => ({
                ...f,
                subjectId: v,
                code: sub?.code || f.code,
                name: sub?.name || f.name,
              }));
            }}>
              <SelectTrigger><SelectValue placeholder="From masters catalog" /></SelectTrigger>
              <SelectContent>
                {subjects.map((s: { id: string; code: string; name: string }) => (
                  <SelectItem key={s.id} value={s.id}>{s.code} — {s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!form.subjectId && (
            <>
              <div><Label>Code</Label><Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} /></div>
              <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
            </>
          )}
          {isAdmin ? (
            <InstructorSelectField
              open={open}
              value={form.instructorId}
              onChange={(instructorId) => setForm((f) => ({ ...f, instructorId }))}
              departmentId={programDepartmentId}
              description={programDepartmentId ? 'Filtered to instructors in the program department' : 'Select a program first to narrow by department'}
            />
          ) : (
            <p className="text-xs text-muted-foreground rounded-md border bg-muted/40 px-3 py-2">
              You will be assigned as the instructor for this course.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={!form.programId || mutation.isPending} style={{ backgroundColor: NAVY }} className="text-white">
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CreateAssignmentDialog({
  open, onOpenChange, courses,
}: { open: boolean; onOpenChange: (o: boolean) => void; courses: { id: string; code: string; name: string }[] }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({ courseId: '', title: '', description: '', dueDate: '', maxScore: '100' });

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/lms/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          maxScore: parseFloat(form.maxScore),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lms-assignments'] });
      toast({ title: 'Assignment published' });
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Assignment</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Course</Label>
            <Select value={form.courseId} onValueChange={(v) => setForm((f) => ({ ...f, courseId: v }))}>
              <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
              <SelectContent>
                {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.code}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></div>
          <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
          <div><Label>Due date</Label><Input type="datetime-local" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} /></div>
          <div><Label>Max score</Label><Input type="number" value={form.maxScore} onChange={(e) => setForm((f) => ({ ...f, maxScore: e.target.value }))} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={!form.courseId || !form.title || !form.dueDate || mutation.isPending} style={{ backgroundColor: NAVY }} className="text-white">
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type AssignmentEdit = {
  id: string;
  title: string;
  description: string | null;
  dueDate: string;
  maxScore: number;
  status: string;
  allowLate: boolean;
  latePenalty: number;
  type: string;
  course: { code: string };
};

export function EditAssignmentDialog({
  open, onOpenChange, assignment,
}: { open: boolean; onOpenChange: (o: boolean) => void; assignment: AssignmentEdit | null }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    title: '', description: '', dueDate: '', maxScore: '100', status: 'published', allowLate: true, latePenalty: '0',
  });

  useEffect(() => {
    if (!assignment) return;
    const d = new Date(assignment.dueDate);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setForm({
      title: assignment.title,
      description: assignment.description ?? '',
      dueDate: local,
      maxScore: String(assignment.maxScore),
      status: assignment.status,
      allowLate: assignment.allowLate,
      latePenalty: String(assignment.latePenalty),
    });
  }, [assignment]);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/lms/assignments?id=${assignment?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          description: form.description || null,
          dueDate: form.dueDate,
          maxScore: parseFloat(form.maxScore),
          status: form.status,
          allowLate: form.allowLate,
          latePenalty: parseFloat(form.latePenalty),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lms-assignments'] });
      toast({ title: 'Assignment updated' });
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  if (!assignment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Assignment</DialogTitle>
          <DialogDescription>{assignment.course.code}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div><Label>Title</Label><Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></div>
          <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></div>
          <div><Label>Due date</Label><Input type="datetime-local" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Max score</Label><Input type="number" value={form.maxScore} onChange={(e) => setForm((f) => ({ ...f, maxScore: e.target.value }))} /></div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="grading">Grading</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <Label htmlFor="allow-late">Allow late submissions</Label>
            <Switch id="allow-late" checked={form.allowLate} onCheckedChange={(v) => setForm((f) => ({ ...f, allowLate: v }))} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={!form.title || !form.dueDate || mutation.isPending} style={{ backgroundColor: NAVY }} className="text-white">
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SubmitAssignmentDialog({
  open, onOpenChange, assignment,
}: { open: boolean; onOpenChange: (o: boolean) => void; assignment: { id: string; title: string } | null }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [content, setContent] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/lms/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignmentId: assignment?.id, content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lms-assignments'] });
      toast({ title: 'Assignment submitted' });
      setContent('');
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  if (!assignment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Submit: {assignment.title}</DialogTitle>
        </DialogHeader>
        <Textarea rows={6} placeholder="Your answer..." value={content} onChange={(e) => setContent(e.target.value)} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={!content.trim() || mutation.isPending} className="gap-1">
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PublishSubjectDialog({
  open, onOpenChange, subject,
}: { open: boolean; onOpenChange: (o: boolean) => void; subject: { id: string; code: string; name: string; departmentId: string } | null }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [programId, setProgramId] = useState('');
  const [instructorId, setInstructorId] = useState('');

  useEffect(() => {
    if (!open) {
      setProgramId('');
      setInstructorId('');
    }
  }, [open]);

  const { data } = useQuery({
    queryKey: ['masters-programs-publish'],
    queryFn: () => fetch('/api/masters/programs?limit=50').then((r) => r.json()),
    enabled: open,
  });
  const programs = (data?.programs ?? []).filter(
    (p: { departmentId: string }) => !subject || p.departmentId === subject.departmentId
  );

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/masters/subjects/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectId: subject?.id, programId, instructorId: instructorId || undefined }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      return d;
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['masters-subjects'] });
      qc.invalidateQueries({ queryKey: ['lms-courses'] });
      toast({ title: d.created ? 'Course created from subject' : 'Course updated from subject' });
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  if (!subject) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Publish to LMS</DialogTitle>
          <DialogDescription>{subject.code} — {subject.name}</DialogDescription>
        </DialogHeader>
        <Select value={programId} onValueChange={setProgramId}>
          <SelectTrigger><SelectValue placeholder="Select program" /></SelectTrigger>
          <SelectContent>
            {programs.map((p: { id: string; code: string }) => (
              <SelectItem key={p.id} value={p.id}>{p.code}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <InstructorSelectField
          open={open}
          value={instructorId}
          onChange={setInstructorId}
          departmentId={subject.departmentId}
          description="Assign faculty who will manage this course and its roster"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={!programId || mutation.isPending} style={{ backgroundColor: NAVY }} className="text-white">
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Publish
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type RosterStudent = {
  enrollmentId: string;
  enrolledAt: string;
  student: { id: string; name: string; email: string; employeeId: string | null; department: string | null };
};

export function AssignCourseInstructorDialog({
  open,
  onOpenChange,
  course,
  departmentId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  course: {
    id: string;
    code: string;
    name: string;
    instructor: { id: string; name: string; email: string } | null;
  } | null;
  departmentId?: string | null;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [instructorId, setInstructorId] = useState('');

  useEffect(() => {
    if (open && course) {
      setInstructorId(course.instructor?.id ?? '');
    }
    if (!open) setInstructorId('');
  }, [open, course]);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/lms/courses?id=${course!.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instructorId: instructorId || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to assign instructor');
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lms-courses'] });
      toast({ title: 'Instructor updated' });
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  if (!course) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Instructor</DialogTitle>
          <DialogDescription>{course.code} — {course.name}</DialogDescription>
        </DialogHeader>
        <InstructorSelectField
          open={open}
          value={instructorId}
          onChange={setInstructorId}
          departmentId={departmentId}
          description="This faculty member can manage the course roster, modules, and assignments"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            style={{ backgroundColor: NAVY }}
            className="text-white"
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CourseRosterDialog({
  open, onOpenChange, course, campusWide, readOnly,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  course: { id: string; code: string; name: string } | null;
  campusWide?: boolean;
  readOnly?: boolean;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ['course-roster', course?.id],
    queryFn: () => fetch(`/api/lms/enrollments?courseId=${course!.id}`).then((r) => {
      if (!r.ok) throw new Error('Failed to load roster');
      return r.json();
    }),
    enabled: open && !!course?.id,
  });

  const { data: candidatesData } = useQuery({
    queryKey: ['roster-candidates', course?.id, search, campusWide],
    queryFn: () => fetch(`/api/lms/roster-candidates?courseId=${course!.id}&search=${encodeURIComponent(search)}${campusWide ? '&campusWide=true' : ''}`).then((r) => r.json()),
    enabled: open && !!course?.id && !readOnly,
  });

  const roster: RosterStudent[] = data?.roster ?? [];
  const candidates = candidatesData?.candidates ?? [];

  const addMutation = useMutation({
    mutationFn: async (studentIds: string[]) => {
      const res = await fetch('/api/lms/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: course?.id, studentIds }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      return d;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['course-roster', course?.id] });
      qc.invalidateQueries({ queryKey: ['roster-candidates', course?.id] });
      qc.invalidateQueries({ queryKey: ['lms-courses'] });
      setSelected(new Set());
      toast({ title: 'Added to roster' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const removeMutation = useMutation({
    mutationFn: async (studentId: string) => {
      const res = await fetch(`/api/lms/enrollments?courseId=${course?.id}&studentId=${studentId}`, { method: 'DELETE' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      return d;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['course-roster', course?.id] });
      qc.invalidateQueries({ queryKey: ['lms-courses'] });
      toast({ title: 'Removed from roster' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const toggleCandidate = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!course) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{readOnly ? 'View Roster' : 'Course Roster'} — {course.code}</DialogTitle>
          <DialogDescription>
            {course.name} · {roster.length} enrolled{readOnly ? ' (read-only)' : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!readOnly && (
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Add students</Label>
            {campusWide && <p className="text-[10px] text-muted-foreground">Campus-wide search — any active student</p>}
            <Input placeholder="Search by name, email, ID..." className="mt-1 h-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            {candidates.length > 0 && (
              <div className="mt-2 max-h-32 overflow-y-auto border rounded-md divide-y">
                {candidates.map((c: { id: string; name: string; employeeId: string | null }) => (
                  <label key={c.id} className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 cursor-pointer">
                    <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggleCandidate(c.id)} />
                    <span className="font-medium">{c.name}</span>
                    <span className="text-xs text-muted-foreground font-mono">{c.employeeId || c.id.slice(0, 8)}</span>
                  </label>
                ))}
              </div>
            )}
            {selected.size > 0 && (
              <Button size="sm" className="mt-2" onClick={() => addMutation.mutate([...selected])} disabled={addMutation.isPending}>
                {addMutation.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                Add {selected.size} student{selected.size > 1 ? 's' : ''}
              </Button>
            )}
          </div>
          )}

          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Enrolled ({roster.length})</Label>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : roster.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No students on roster yet.</p>
            ) : (
              <div className="mt-2 border rounded-md divide-y max-h-64 overflow-y-auto">
                {roster.map((row) => (
                  <div key={row.enrollmentId} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{row.student.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{row.student.email}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] font-mono text-muted-foreground">{row.student.employeeId || '—'}</span>
                      {!readOnly && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => removeMutation.mutate(row.student.id)} disabled={removeMutation.isPending}>
                        Remove
                      </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type SubmissionRow = {
  id: string;
  content: string | null;
  score: number | null;
  feedback: string | null;
  status: string;
  submittedAt: string;
  student: { id: string; name: string; email: string; employeeId: string | null };
};

export function GradeSubmissionsDialog({
  open, onOpenChange, assignment,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  assignment: { id: string; title: string; maxScore: number } | null;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [grades, setGrades] = useState<Record<string, { score: string; feedback: string }>>({});

  const { data, isLoading } = useQuery({
    queryKey: ['assignment-submissions', assignment?.id],
    queryFn: () => fetch(`/api/lms/submissions?assignmentId=${assignment!.id}`).then((r) => {
      if (!r.ok) throw new Error('Failed to load submissions');
      return r.json();
    }),
    enabled: open && !!assignment?.id,
  });

  const submissions: SubmissionRow[] = data?.submissions ?? [];

  const gradeMutation = useMutation({
    mutationFn: async ({ id, score, feedback }: { id: string; score: number; feedback: string }) => {
      const res = await fetch('/api/lms/submissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, score, feedback }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      return d;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['assignment-submissions', assignment?.id] });
      qc.invalidateQueries({ queryKey: ['lms-assignments'] });
      qc.invalidateQueries({ queryKey: ['lms-gradebook'] });
      toast({ title: 'Graded successfully' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  if (!assignment) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Grade Submissions — {assignment.title}</DialogTitle>
          <DialogDescription>Max score: {assignment.maxScore} · {submissions.length} submission(s)</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : submissions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No submissions yet.</p>
        ) : (
          <div className="space-y-4">
            {submissions.map((s) => {
              const g = grades[s.id] ?? { score: s.score?.toString() ?? '', feedback: s.feedback ?? '' };
              return (
                <div key={s.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">{s.student.name}</p>
                      <p className="text-[10px] text-muted-foreground">{s.student.employeeId || s.student.email}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] capitalize">{s.status}</Badge>
                  </div>
                  {s.content && (
                    <p className="text-xs bg-muted/40 rounded p-2 line-clamp-3">{s.content}</p>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px]">Score (/{assignment.maxScore})</Label>
                      <Input
                        type="number"
                        min={0}
                        max={assignment.maxScore}
                        className="h-8 text-sm"
                        value={g.score}
                        onChange={(e) => setGrades((prev) => ({ ...prev, [s.id]: { ...g, score: e.target.value } }))}
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">Feedback</Label>
                      <Input
                        className="h-8 text-sm"
                        placeholder="Optional feedback"
                        value={g.feedback}
                        onChange={(e) => setGrades((prev) => ({ ...prev, [s.id]: { ...g, feedback: e.target.value } }))}
                      />
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="h-7 text-xs text-white"
                    style={{ backgroundColor: NAVY }}
                    disabled={gradeMutation.isPending || g.score === ''}
                    onClick={() => gradeMutation.mutate({
                      id: s.id,
                      score: parseFloat(g.score),
                      feedback: g.feedback,
                    })}
                  >
                    {gradeMutation.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                    Save Grade
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

type QuizQuestionForm = {
  courseId: string;
  question: string;
  type: 'mcq' | 'true_false' | 'short_answer';
  options: string;
  correctAnswer: string;
  points: string;
  difficulty: 'easy' | 'medium' | 'hard';
};

const emptyQuizForm = (): QuizQuestionForm => ({
  courseId: '',
  question: '',
  type: 'mcq',
  options: '',
  correctAnswer: '',
  points: '1',
  difficulty: 'medium',
});

export function CreateQuizDialog({
  open, onOpenChange, courses,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  courses: { id: string; code: string; name: string }[];
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState<QuizQuestionForm>(emptyQuizForm());

  const mutation = useMutation({
    mutationFn: async () => {
      const options =
        form.type === 'short_answer'
          ? null
          : form.type === 'true_false'
            ? JSON.stringify(['True', 'False'])
            : JSON.stringify(
                form.options.split('\n').map((o) => o.trim()).filter(Boolean)
              );
      const res = await fetch('/api/lms/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: form.courseId,
          question: form.question,
          type: form.type,
          options,
          correctAnswer: form.correctAnswer,
          points: parseFloat(form.points),
          difficulty: form.difficulty,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lms-quizzes'] });
      toast({ title: 'Quiz question added' });
      setForm(emptyQuizForm());
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Quiz Question</DialogTitle>
          <DialogDescription>Create a question for a course quiz bank.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Course</Label>
            <Select value={form.courseId} onValueChange={(v) => setForm((f) => ({ ...f, courseId: v }))}>
              <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
              <SelectContent>
                {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Question</Label><Textarea rows={3} value={form.question} onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v as QuizQuestionForm['type'] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mcq">Multiple Choice</SelectItem>
                  <SelectItem value="true_false">True / False</SelectItem>
                  <SelectItem value="short_answer">Short Answer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Difficulty</Label>
              <Select value={form.difficulty} onValueChange={(v) => setForm((f) => ({ ...f, difficulty: v as QuizQuestionForm['difficulty'] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {form.type === 'mcq' && (
            <div>
              <Label>Options (one per line)</Label>
              <Textarea rows={4} placeholder="Option A&#10;Option B&#10;Option C" value={form.options} onChange={(e) => setForm((f) => ({ ...f, options: e.target.value }))} />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Correct answer</Label><Input value={form.correctAnswer} onChange={(e) => setForm((f) => ({ ...f, correctAnswer: e.target.value }))} placeholder={form.type === 'true_false' ? 'True or False' : 'Exact match'} /></div>
            <div><Label>Points</Label><Input type="number" min={1} value={form.points} onChange={(e) => setForm((f) => ({ ...f, points: e.target.value }))} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!form.courseId || !form.question.trim() || !form.correctAnswer.trim() || mutation.isPending}
            style={{ backgroundColor: NAVY }}
            className="text-white"
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add Question
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type QuizEditQuestion = {
  id: string;
  question: string;
  type: 'mcq' | 'true_false' | 'short_answer' | 'coding';
  options: string;
  correctAnswer: string;
  points: number;
  difficulty: 'easy' | 'medium' | 'hard';
  course: { code: string };
  codingMeta?: { title: string; slug: string } | null;
};

function optionsToLines(raw: string, type: QuizEditQuestion['type']): string {
  if (type === 'true_false') return 'True\nFalse';
  if (type === 'short_answer' || type === 'coding') return '';
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String).join('\n') : '';
  } catch {
    return '';
  }
}

export function EditQuizDialog({
  open, onOpenChange, question,
}: { open: boolean; onOpenChange: (o: boolean) => void; question: QuizEditQuestion | null }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const isCoding = question?.type === 'coding';
  const [form, setForm] = useState({
    question: '', options: '', correctAnswer: '', points: '1', difficulty: 'medium' as QuizEditQuestion['difficulty'],
  });

  useEffect(() => {
    if (!question) return;
    setForm({
      question: question.question,
      options: optionsToLines(question.options, question.type),
      correctAnswer: question.correctAnswer ?? '',
      points: String(question.points),
      difficulty: question.difficulty,
    });
  }, [question]);

  const mutation = useMutation({
    mutationFn: async () => {
      const options =
        question?.type === 'short_answer' || isCoding
          ? undefined
          : question?.type === 'true_false'
            ? JSON.stringify(['True', 'False'])
            : JSON.stringify(form.options.split('\n').map((o) => o.trim()).filter(Boolean));

      const res = await fetch(`/api/lms/quizzes?id=${question?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: form.question,
          ...(options !== undefined && { options }),
          ...(!isCoding && { correctAnswer: form.correctAnswer }),
          points: parseFloat(form.points),
          difficulty: form.difficulty,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lms-quizzes'] });
      qc.invalidateQueries({ queryKey: ['lms-coding-problems'] });
      toast({ title: 'Question updated' });
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  if (!question) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {isCoding ? 'Coding Problem' : 'Quiz Question'}</DialogTitle>
          <DialogDescription>{question.course.code}{isCoding && question.codingMeta?.slug ? ` · ${question.codingMeta.slug}` : ''}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div><Label>{isCoding ? 'Title' : 'Question'}</Label><Textarea rows={3} value={form.question} onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))} /></div>
          {!isCoding && question.type === 'mcq' && (
            <div>
              <Label>Options (one per line)</Label>
              <Textarea rows={4} value={form.options} onChange={(e) => setForm((f) => ({ ...f, options: e.target.value }))} />
            </div>
          )}
          {!isCoding && (
            <div><Label>Correct answer</Label><Input value={form.correctAnswer} onChange={(e) => setForm((f) => ({ ...f, correctAnswer: e.target.value }))} /></div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Points</Label><Input type="number" min={1} value={form.points} onChange={(e) => setForm((f) => ({ ...f, points: e.target.value }))} /></div>
            <div>
              <Label>Difficulty</Label>
              <Select value={form.difficulty} onValueChange={(v) => setForm((f) => ({ ...f, difficulty: v as QuizEditQuestion['difficulty'] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {isCoding && (
            <p className="text-xs text-muted-foreground">Test cases and starter code are fixed for bundled problems. Edit title, points, or difficulty only.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!form.question.trim() || (!isCoding && !form.correctAnswer.trim()) || mutation.isPending}
            style={{ backgroundColor: NAVY }}
            className="text-white"
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type TakeQuizQuestion = {
  id: string;
  question: string;
  type: 'mcq' | 'true_false' | 'short_answer';
  options: string;
  points: number;
};

function parseQuizOptions(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

export function TakeQuizDialog({
  open, onOpenChange, courses,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  courses: { id: string; code: string; name: string }[];
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [courseId, setCourseId] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['take-quiz-questions', courseId],
    queryFn: () => fetch(`/api/lms/quizzes?courseId=${courseId}&limit=100`).then((r) => {
      if (!r.ok) throw new Error('Failed to load questions');
      return r.json();
    }),
    enabled: open && !!courseId,
  });

  const questions: TakeQuizQuestion[] = data?.questions ?? [];

  const submitMutation = useMutation({
    mutationFn: async () => {
      const timeTaken = startedAt ? Math.round((Date.now() - startedAt) / 1000) : undefined;
      const res = await fetch('/api/lms/quizzes/attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, answers, timeTaken }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to submit');
      return d;
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['lms-quizzes'] });
      qc.invalidateQueries({ queryKey: ['lms-gradebook'] });
      toast({ title: 'Quiz submitted', description: `Score: ${d.score}/${d.totalPoints} (${d.percentage}%)` });
      setAnswers({});
      setCourseId('');
      setStartedAt(null);
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const allAnswered = questions.length > 0 && questions.every((q) => answers[q.id]?.trim());

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) { setAnswers({}); setStartedAt(null); } }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Take Quiz</DialogTitle>
          <DialogDescription>Answer all questions for the selected course, then submit.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Course</Label>
            <Select value={courseId} onValueChange={(v) => { setCourseId(v); setAnswers({}); setStartedAt(Date.now()); }}>
              <SelectTrigger><SelectValue placeholder="Select enrolled course" /></SelectTrigger>
              <SelectContent>
                {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {isLoading && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
          {!isLoading && courseId && questions.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">No quiz questions for this course yet.</p>
          )}
          {questions.map((q, idx) => {
            const opts = q.type === 'short_answer' ? [] : parseQuizOptions(q.options);
            return (
              <div key={q.id} className="border rounded-lg p-3 space-y-2">
                <p className="text-sm font-medium">{idx + 1}. {q.question} <span className="text-muted-foreground font-normal">({q.points} pts)</span></p>
                {q.type === 'short_answer' ? (
                  <Input
                    placeholder="Your answer"
                    value={answers[q.id] ?? ''}
                    onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                  />
                ) : (
                  <div className="space-y-1.5">
                    {opts.map((opt) => (
                      <label key={opt} className="flex items-center gap-2 text-sm cursor-pointer rounded px-2 py-1.5 hover:bg-muted/50">
                        <input
                          type="radio"
                          name={q.id}
                          checked={answers[q.id] === opt}
                          onChange={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            className="gap-1.5 text-white"
            style={{ backgroundColor: NAVY }}
            disabled={!courseId || !allAnswered || submitMutation.isPending}
            onClick={() => submitMutation.mutate()}
          >
            {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Submit Quiz
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type ModuleRow = {
  id: string;
  title: string;
  description: string | null;
  orderIndex: number;
  isPublished: boolean;
  lessons: { id: string; title: string; type: string; contentUrl?: string | null; isPublished?: boolean }[];
  _count: { lessons: number };
};

export function ManageModulesDialog({
  open, onOpenChange, course,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  course: { id: string; code: string; name: string } | null;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [moduleForm, setModuleForm] = useState({ title: '', description: '' });
  const [lessonForm, setLessonForm] = useState({ moduleId: '', title: '', type: 'video', contentUrl: '' });
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editLessonForm, setEditLessonForm] = useState({ title: '', type: 'video', contentUrl: '' });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['lms-modules', course?.id],
    queryFn: () => fetch(`/api/lms/modules?courseId=${course!.id}`).then((r) => {
      if (!r.ok) throw new Error('Failed to load modules');
      return r.json();
    }),
    enabled: open && !!course?.id,
  });

  const modules: ModuleRow[] = data?.modules ?? [];

  const createModule = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/lms/modules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId: course?.id, title: moduleForm.title, description: moduleForm.description || null }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      return d;
    },
    onSuccess: () => {
      refetch();
      qc.invalidateQueries({ queryKey: ['lms-courses'] });
      setModuleForm({ title: '', description: '' });
      toast({ title: 'Module created' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteModule = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/lms/modules?id=${id}`, { method: 'DELETE' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      return d;
    },
    onSuccess: () => {
      refetch();
      qc.invalidateQueries({ queryKey: ['lms-courses'] });
      toast({ title: 'Module deleted' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const createLesson = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/lms/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          moduleId: lessonForm.moduleId,
          title: lessonForm.title,
          type: lessonForm.type,
          contentUrl: lessonForm.contentUrl || null,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      return d;
    },
    onSuccess: () => {
      refetch();
      qc.invalidateQueries({ queryKey: ['lms-courses'] });
      setLessonForm((f) => ({ ...f, title: '', contentUrl: '' }));
      toast({ title: 'Lesson added' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const toggleModulePublish = useMutation({
    mutationFn: async ({ id, isPublished }: { id: string; isPublished: boolean }) => {
      const res = await fetch(`/api/lms/modules?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublished }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      return d;
    },
    onSuccess: () => {
      refetch();
      qc.invalidateQueries({ queryKey: ['lms-courses'] });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const updateLesson = useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; title: string; type: string; contentUrl: string | null }) => {
      const res = await fetch(`/api/lms/lessons?id=${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      return d;
    },
    onSuccess: () => {
      refetch();
      qc.invalidateQueries({ queryKey: ['lms-courses'] });
      setEditingLessonId(null);
      toast({ title: 'Lesson updated' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const deleteLesson = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/lms/lessons?id=${id}`, { method: 'DELETE' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      return d;
    },
    onSuccess: () => {
      refetch();
      qc.invalidateQueries({ queryKey: ['lms-courses'] });
      toast({ title: 'Lesson deleted' });
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  if (!course) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Modules — {course.code}</DialogTitle>
          <DialogDescription>{course.name}</DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border p-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">New module</p>
          <Input placeholder="Module title" value={moduleForm.title} onChange={(e) => setModuleForm((f) => ({ ...f, title: e.target.value }))} />
          <Input placeholder="Description (optional)" value={moduleForm.description} onChange={(e) => setModuleForm((f) => ({ ...f, description: e.target.value }))} />
          <Button size="sm" disabled={!moduleForm.title.trim() || createModule.isPending} onClick={() => createModule.mutate()} style={{ backgroundColor: NAVY }} className="text-white">
            {createModule.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            <Plus className="mr-1 h-3 w-3" /> Add Module
          </Button>
        </div>

        <div className="rounded-lg border p-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Add lesson to module</p>
          <Select value={lessonForm.moduleId} onValueChange={(v) => setLessonForm((f) => ({ ...f, moduleId: v }))}>
            <SelectTrigger><SelectValue placeholder="Select module" /></SelectTrigger>
            <SelectContent>
              {modules.map((m) => <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Lesson title" value={lessonForm.title} onChange={(e) => setLessonForm((f) => ({ ...f, title: e.target.value }))} />
            <Select value={lessonForm.type} onValueChange={(v) => setLessonForm((f) => ({ ...f, type: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="document">Document</SelectItem>
                <SelectItem value="text">Text</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Input placeholder="Content URL (optional)" value={lessonForm.contentUrl} onChange={(e) => setLessonForm((f) => ({ ...f, contentUrl: e.target.value }))} />
          <Button size="sm" variant="outline" disabled={!lessonForm.moduleId || !lessonForm.title.trim() || createLesson.isPending} onClick={() => createLesson.mutate()}>
            {createLesson.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            Add Lesson
          </Button>
        </div>

        <div>
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Modules ({modules.length})</Label>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : modules.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No modules yet.</p>
          ) : (
            <div className="mt-2 space-y-2 max-h-64 overflow-y-auto">
              {modules.map((m) => (
                <div key={m.id} className="border rounded-md p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{m.orderIndex + 1}. {m.title}</p>
                      {m.description && <p className="text-xs text-muted-foreground mt-0.5">{m.description}</p>}
                      <p className="text-[10px] text-muted-foreground mt-1">{m._count.lessons} lesson(s)</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <Switch
                          checked={m.isPublished}
                          disabled={toggleModulePublish.isPending}
                          onCheckedChange={(v) => toggleModulePublish.mutate({ id: m.id, isPublished: v })}
                        />
                        <span className="text-[10px] text-muted-foreground w-14">{m.isPublished ? 'Published' : 'Draft'}</span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteModule.mutate(m.id)} disabled={deleteModule.isPending}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  {m.lessons.length > 0 && (
                    <ul className="mt-2 space-y-1.5 pl-1">
                      {m.lessons.map((l) => (
                        <li key={l.id} className="text-xs border rounded px-2 py-1.5">
                          {editingLessonId === l.id ? (
                            <div className="space-y-1.5">
                              <Input value={editLessonForm.title} onChange={(e) => setEditLessonForm((f) => ({ ...f, title: e.target.value }))} className="h-7 text-xs" />
                              <Input placeholder="Content URL" value={editLessonForm.contentUrl} onChange={(e) => setEditLessonForm((f) => ({ ...f, contentUrl: e.target.value }))} className="h-7 text-xs" />
                              <div className="flex gap-1">
                                <Button size="sm" className="h-6 text-[10px]" disabled={updateLesson.isPending} onClick={() => updateLesson.mutate({ id: l.id, title: editLessonForm.title, type: editLessonForm.type, contentUrl: editLessonForm.contentUrl || null })}>Save</Button>
                                <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setEditingLessonId(null)}>Cancel</Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-muted-foreground">• {l.title} ({l.type})</span>
                              <div className="flex gap-0.5">
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditingLessonId(l.id); setEditLessonForm({ title: l.title, type: l.type, contentUrl: l.contentUrl ?? '' }); }}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteLesson.mutate(l.id)} disabled={deleteLesson.isPending}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CreateCodingProblemDialog({
  open, onOpenChange, courses,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  courses: { id: string; code: string; name: string }[];
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [courseId, setCourseId] = useState('');
  const [bundleKey, setBundleKey] = useState(BUNDLED_CODING_PROBLEMS[0]?.meta.slug ?? '');
  const [mode, setMode] = useState<'bundled' | 'custom'>('bundled');
  const [custom, setCustom] = useState({
    title: '',
    slug: '',
    functionName: '',
    statement: '',
    difficulty: 'medium' as 'easy' | 'medium' | 'hard',
    points: '10',
    testCasesJson: '[\n  {"args": [[[2,7,11,15], 9]], "expected": [0,1], "isSample": true}\n]',
  });

  const bundled = BUNDLED_CODING_PROBLEMS.find((p) => p.meta.slug === bundleKey);

  const mutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const res = await fetch('/api/lms/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['lms-quizzes'] });
      qc.invalidateQueries({ queryKey: ['lms-coding-problems'] });
      toast({ title: 'Coding problem published' });
      onOpenChange(false);
    },
    onError: (e: Error) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });

  const publishBundled = () => {
    if (!courseId || !bundled) return;
    mutation.mutate({
      courseId,
      type: 'coding',
      question: bundled.statement,
      difficulty: bundled.difficulty,
      points: bundled.points,
      codingMeta: bundled.meta,
    });
  };

  const publishCustom = () => {
    if (!courseId || !custom.title.trim() || !custom.functionName.trim()) return;
    let testCases: CodingProblemMeta['testCases'];
    try {
      testCases = JSON.parse(custom.testCasesJson);
      if (!Array.isArray(testCases) || testCases.length === 0) throw new Error('Need at least one test case');
    } catch (e) {
      toast({ title: 'Invalid test cases JSON', description: e instanceof Error ? e.message : 'Parse error', variant: 'destructive' });
      return;
    }
    const slug = custom.slug.trim() || custom.title.trim().toLowerCase().replace(/\s+/g, '-');
    const meta: CodingProblemMeta = {
      slug,
      title: custom.title.trim(),
      topics: ['Custom'],
      constraints: 'See problem statement',
      examples: [],
      functionName: custom.functionName.trim(),
      starterCode: {
        javascript: `var ${custom.functionName.trim()} = function() {\n  // Write your code here\n};`,
        python: `class Solution:\n    def ${custom.functionName.trim()}(self):\n        pass`,
      },
      timeLimitMs: 2000,
      compareMode: 'deep',
      testCases,
    };
    mutation.mutate({
      courseId,
      type: 'coding',
      question: custom.statement.trim() || custom.title.trim(),
      difficulty: custom.difficulty,
      points: parseFloat(custom.points) || 10,
      codingMeta: meta,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Coding Problem</DialogTitle>
          <DialogDescription>Bundled templates or build a custom problem with test cases.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Course</Label>
            <Select value={courseId} onValueChange={setCourseId}>
              <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
              <SelectContent>
                {courses.map((c) => <SelectItem key={c.id} value={c.id}>{c.code} — {c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'bundled' | 'custom')}>
            <TabsList className="w-full">
              <TabsTrigger value="bundled" className="flex-1 text-xs">Bundled</TabsTrigger>
              <TabsTrigger value="custom" className="flex-1 text-xs">Custom</TabsTrigger>
            </TabsList>
            <TabsContent value="bundled" className="space-y-3 mt-3">
              <div>
                <Label>Problem template</Label>
                <Select value={bundleKey} onValueChange={setBundleKey}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BUNDLED_CODING_PROBLEMS.map((p) => (
                      <SelectItem key={p.meta.slug} value={p.meta.slug}>
                        {p.meta.title} ({p.difficulty}) — {p.courseCode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {bundled && (
                <div className="rounded-md border p-3 text-xs space-y-1 bg-muted/30">
                  <p className="font-semibold">{bundled.meta.title}</p>
                  <p className="text-muted-foreground">{bundled.meta.topics.join(' · ')}</p>
                  <p>{bundled.meta.testCases.length} test cases ({bundled.meta.testCases.filter((t) => t.isSample).length} sample)</p>
                </div>
              )}
            </TabsContent>
            <TabsContent value="custom" className="space-y-3 mt-3">
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Title</Label><Input value={custom.title} onChange={(e) => setCustom((f) => ({ ...f, title: e.target.value }))} /></div>
                <div><Label>Function name</Label><Input value={custom.functionName} onChange={(e) => setCustom((f) => ({ ...f, functionName: e.target.value }))} placeholder="twoSum" /></div>
              </div>
              <div><Label>Slug (optional)</Label><Input value={custom.slug} onChange={(e) => setCustom((f) => ({ ...f, slug: e.target.value }))} placeholder="my-problem" /></div>
              <div><Label>Statement</Label><Textarea rows={4} value={custom.statement} onChange={(e) => setCustom((f) => ({ ...f, statement: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Difficulty</Label>
                  <Select value={custom.difficulty} onValueChange={(v) => setCustom((f) => ({ ...f, difficulty: v as typeof custom.difficulty }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Easy</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="hard">Hard</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Points</Label><Input type="number" value={custom.points} onChange={(e) => setCustom((f) => ({ ...f, points: e.target.value }))} /></div>
              </div>
              <div>
                <Label>Test cases (JSON array)</Label>
                <Textarea rows={6} className="font-mono text-xs" value={custom.testCasesJson} onChange={(e) => setCustom((f) => ({ ...f, testCasesJson: e.target.value }))} />
                <p className="text-[10px] text-muted-foreground mt-1">Each case: args (array of args), expected, optional isSample</p>
              </div>
            </TabsContent>
          </Tabs>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={mode === 'bundled' ? publishBundled : publishCustom}
            disabled={!courseId || mutation.isPending || (mode === 'bundled' ? !bundled : !custom.title.trim() || !custom.functionName.trim())}
            style={{ backgroundColor: NAVY }}
            className="text-white"
          >
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Publish Problem
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
