'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import {
  Play, Send, CheckCircle2, XCircle, Clock, ChevronRight,
  Code2, Filter, Search, Loader2, Trophy, AlertCircle, Sparkles, Wand2, Pencil, Trash2,
} from 'lucide-react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { CodingLanguage, CodingProblemMeta, JudgeResult } from '@/lib/coding-types';
import { parseCodingMeta } from '@/lib/coding-types';
import { DEMO_SOLUTIONS } from '@/lib/demo-walkthrough';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

const NAVY = '#1A3C6E';

export interface CodingProblem {
  id: string;
  question: string;
  type: string;
  points: number;
  difficulty: 'easy' | 'medium' | 'hard';
  course: { name: string; code: string };
  codingMeta: CodingProblemMeta | null;
}

const difficultyStyle: Record<string, string> = {
  easy: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400',
  medium: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400',
  hard: 'text-red-600 bg-red-50 border-red-200 dark:bg-red-950/40 dark:text-red-400',
};

const statusStyle: Record<string, { label: string; className: string }> = {
  Accepted: { label: 'Accepted', className: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-900/40' },
  'Wrong Answer': { label: 'Wrong Answer', className: 'text-red-600 bg-red-100 dark:bg-red-900/40' },
  'Partially Accepted': { label: 'Partial', className: 'text-amber-600 bg-amber-100 dark:bg-amber-900/40' },
};

function TestResults({ result, loading }: { result: JudgeResult | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Running tests…
      </div>
    );
  }
  if (!result) {
    return (
      <p className="text-xs text-muted-foreground text-center py-6">
        Click <strong>Run</strong> to test against sample cases, or <strong>Submit</strong> for full grading.
      </p>
    );
  }

  return (
    <div className="space-y-2 p-3">
      <div className="flex items-center justify-between text-sm">
        <span className={cn('font-semibold px-2 py-0.5 rounded', result.allPassed ? 'text-emerald-600' : 'text-amber-600')}>
          {result.passed}/{result.total} passed
        </span>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" /> {result.totalRuntimeMs}ms total
        </span>
      </div>
      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {result.results.map((r) => (
          <div
            key={r.index}
            className={cn(
              'rounded-md border px-3 py-2 text-xs',
              r.passed ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-900' : 'border-red-200 bg-red-50/50 dark:border-red-900'
            )}
          >
            <div className="flex items-center gap-2 font-medium">
              {r.passed ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <XCircle className="h-3.5 w-3.5 text-red-600" />}
              Case {r.index + 1}{r.isSample ? ' (sample)' : ''}
              <span className="text-muted-foreground font-normal ml-auto">{r.runtimeMs}ms</span>
            </div>
            <div className="mt-1 grid gap-0.5 text-muted-foreground font-mono">
              <div>in: {r.input}</div>
              <div>expected: {r.expected}</div>
              {!r.passed && <div>got: {r.actual}</div>}
              {r.error && <div className="text-red-600">error: {r.error}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProblemDescription({ problem }: { problem: CodingProblem }) {
  const meta = problem.codingMeta;
  if (!meta) return <p className="text-sm text-muted-foreground p-4">Invalid problem data.</p>;

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        <div>
          <h2 className="text-lg font-bold">{meta.title}</h2>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <Badge variant="outline" className={cn('text-[10px] capitalize', difficultyStyle[problem.difficulty])}>
              {problem.difficulty}
            </Badge>
            <Badge variant="outline" className="text-[10px] font-mono">{problem.course.code}</Badge>
            {meta.topics.map((t) => (
              <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>
            ))}
            <Badge variant="outline" className="text-[10px]">{problem.points} pts</Badge>
          </div>
        </div>

        <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed">
          <ReactMarkdown>{problem.question}</ReactMarkdown>
        </div>

        {meta.examples.map((ex, i) => (
          <div key={i} className="rounded-lg border bg-muted/30 p-3 space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Example {i + 1}</p>
            <pre className="text-xs font-mono whitespace-pre-wrap bg-background rounded p-2 border">Input: {ex.input}</pre>
            <pre className="text-xs font-mono whitespace-pre-wrap bg-background rounded p-2 border">Output: {ex.output}</pre>
            {ex.explanation && <p className="text-xs text-muted-foreground">{ex.explanation}</p>}
          </div>
        ))}

        <div className="rounded-lg border p-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Constraints</p>
          <pre className="text-xs font-mono whitespace-pre-wrap text-muted-foreground">{meta.constraints}</pre>
        </div>
      </div>
    </ScrollArea>
  );
}

export function CodingWorkspace({
  learnerMode = true,
  onEditProblem,
  onDeleteProblem,
}: {
  learnerMode?: boolean;
  onEditProblem?: (problem: CodingProblem) => void;
  onDeleteProblem?: (problemId: string) => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [language, setLanguage] = useState<CodingLanguage>('javascript');
  const [code, setCode] = useState('');
  const [search, setSearch] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [runResult, setRunResult] = useState<JudgeResult | null>(null);
  const [submitStatus, setSubmitStatus] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['lms-coding-problems'],
    queryFn: () => fetch('/api/lms/quizzes?limit=100').then((r) => {
      if (!r.ok) throw new Error('Failed to load problems');
      return r.json();
    }),
  });

  const problems: CodingProblem[] = useMemo(() => {
    return (data?.questions ?? [])
      .filter((q: { type: string }) => q.type === 'coding')
      .map((q: CodingProblem & { options?: string }) => ({
        ...q,
        codingMeta: q.codingMeta ?? parseCodingMeta(q.options ?? null),
      }));
  }, [data]);

  const filtered = useMemo(() => {
    return problems.filter((p) => {
      const meta = p.codingMeta;
      if (!meta) return false;
      if (difficultyFilter !== 'all' && p.difficulty !== difficultyFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return meta.title.toLowerCase().includes(q) || meta.slug.includes(q) || meta.topics.some((t) => t.toLowerCase().includes(q));
      }
      return true;
    });
  }, [problems, search, difficultyFilter]);

  const selected = problems.find((p) => p.id === selectedId) ?? filtered[0] ?? null;

  useEffect(() => {
    if (!selectedId && filtered[0]) setSelectedId(filtered[0].id);
  }, [filtered, selectedId]);

  useEffect(() => {
    if (!selected?.codingMeta) return;
    const starter = selected.codingMeta.starterCode[language]
      ?? selected.codingMeta.starterCode.javascript
      ?? '';
    setCode(starter);
    setRunResult(null);
    setSubmitStatus(null);
    setStartedAt(Date.now());
  }, [selected?.id, language, selected?.codingMeta]);

  const runMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/lms/quizzes/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: selected!.id, code, language }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Run failed');
      return d as JudgeResult & { status: string };
    },
    onSuccess: (d) => {
      setRunResult(d);
      setSubmitStatus(d.status);
      toast({ title: d.status, description: `${d.passed}/${d.total} test cases passed` });
    },
    onError: (e: Error) => toast({ title: 'Run failed', description: e.message, variant: 'destructive' }),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const timeTaken = startedAt ? Math.round((Date.now() - startedAt) / 1000) : undefined;
      const res = await fetch('/api/lms/quizzes/submit-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionId: selected!.id, code, language, timeTaken }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Submit failed');
      return d;
    },
    onSuccess: (d) => {
      setRunResult(d.judge);
      setSubmitStatus(d.status);
      qc.invalidateQueries({ queryKey: ['lms-quizzes'] });
      qc.invalidateQueries({ queryKey: ['lms-gradebook'] });
      toast({
        title: d.status,
        description: d.status === 'Accepted'
          ? `+${d.score} points · ${d.percentage}%`
          : `${d.judge.passed}/${d.judge.total} cases passed`,
        variant: d.status === 'Accepted' ? 'default' : 'destructive',
      });
    },
    onError: (e: Error) => toast({ title: 'Submit failed', description: e.message, variant: 'destructive' }),
  });

  const onSelect = useCallback((id: string) => setSelectedId(id), []);

  const bootstrapMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/demo/bootstrap', { method: 'POST' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed to load demo problems');
      return d;
    },
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ['lms-coding-problems'] });
      qc.invalidateQueries({ queryKey: ['lms-quizzes'] });
      qc.invalidateQueries({ queryKey: ['demo-status'] });
      toast({ title: 'Demo problems loaded', description: d.message });
    },
    onError: (e: Error) => toast({ title: 'Load failed', description: e.message, variant: 'destructive' }),
  });

  const loadDemoSolution = () => {
    const slug = selected?.codingMeta?.slug;
    if (!slug || !DEMO_SOLUTIONS[slug]) return;
    setCode(DEMO_SOLUTIONS[slug]);
    toast({ title: 'Demo solution loaded', description: 'Click Run, then Submit' });
  };

  const demoSolutionAvailable = !!selected?.codingMeta?.slug && !!DEMO_SOLUTIONS[selected.codingMeta.slug];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (problems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center border rounded-xl bg-muted/20 px-4">
        <Code2 className="h-12 w-12 text-muted-foreground/40 mb-3" />
        <p className="text-sm font-medium">No coding problems yet</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-sm mb-4">
          Load bundled LeetCode-style problems (Two Sum, Valid Parentheses, etc.) in one click — no terminal needed.
        </p>
        <Button
          className="gap-2 text-white"
          style={{ backgroundColor: NAVY }}
          disabled={bootstrapMutation.isPending}
          onClick={() => bootstrapMutation.mutate()}
        >
          {bootstrapMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Load demo problems
        </Button>
        <p className="text-[10px] text-muted-foreground mt-3 font-mono">or: npm run demo:prep</p>
      </div>
    );
  }

  return (
    <div className="border rounded-xl overflow-hidden bg-background shadow-sm" style={{ minHeight: '70vh' }}>
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
        <Code2 className="h-4 w-4" style={{ color: NAVY }} />
        <span className="text-sm font-semibold" style={{ color: NAVY }}>Coding Practice</span>
        <Badge variant="outline" className="text-[10px] ml-1">LeetCode-style</Badge>
        {selected && onEditProblem && (
          <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 ml-2" onClick={() => onEditProblem(selected)}>
            <Pencil className="h-3 w-3" /> Edit
          </Button>
        )}
        {selected && onDeleteProblem && (
          <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 text-destructive" onClick={() => onDeleteProblem(selected.id)}>
            <Trash2 className="h-3 w-3" /> Delete
          </Button>
        )}
        {submitStatus && statusStyle[submitStatus] && (
          <Badge className={cn('text-[10px] ml-auto', statusStyle[submitStatus].className)}>
            {statusStyle[submitStatus].label}
          </Badge>
        )}
      </div>

      <PanelGroup direction="horizontal" className="min-h-[65vh]">
        {/* Problem list */}
        <Panel defaultSize={18} minSize={14} maxSize={28}>
          <div className="h-full flex flex-col border-r">
            <div className="p-2 space-y-2 border-b">
              <div className="relative">
                <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search problems…"
                  className="h-8 pl-8 text-xs"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={difficultyFilter} onValueChange={setDifficultyFilter}>
                <SelectTrigger className="h-7 text-xs">
                  <Filter className="h-3 w-3 mr-1" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All difficulties</SelectItem>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <ScrollArea className="flex-1">
              {filtered.map((p) => {
                const meta = p.codingMeta!;
                const active = p.id === selected?.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onSelect(p.id)}
                    className={cn(
                      'w-full text-left px-3 py-2.5 border-b text-xs transition-colors hover:bg-muted/50',
                      active && 'bg-[#1A3C6E]/8 border-l-2 border-l-[#1A3C6E]'
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={cn('font-medium capitalize', difficultyStyle[p.difficulty]?.split(' ')[0])}>
                        {p.difficulty}
                      </span>
                      <ChevronRight className="h-3 w-3 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100" />
                    </div>
                    <p className="font-semibold mt-0.5 truncate">{meta.title}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{p.course.code}</p>
                  </button>
                );
              })}
            </ScrollArea>
          </div>
        </Panel>

        <PanelResizeHandle className="w-1.5 bg-border hover:bg-[#1A3C6E]/30 transition-colors" />

        {/* Description */}
        <Panel defaultSize={32} minSize={22}>
          <div className="h-full border-r">
            {selected ? <ProblemDescription problem={selected} /> : null}
          </div>
        </Panel>

        <PanelResizeHandle className="w-1.5 bg-border hover:bg-[#1A3C6E]/30 transition-colors" />

        {/* Editor + results */}
        <Panel defaultSize={50} minSize={35}>
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b bg-muted/20">
              <Select value={language} onValueChange={(v) => setLanguage(v as CodingLanguage)}>
                <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="javascript">JavaScript</SelectItem>
                  <SelectItem value="python" disabled>Python (soon)</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1.5">
                {demoSolutionAvailable && learnerMode && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs gap-1 text-amber-700 dark:text-amber-400"
                    onClick={loadDemoSolution}
                  >
                    <Wand2 className="h-3 w-3" />
                    Demo solution
                  </Button>
                )}
                {learnerMode && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs gap-1"
                      disabled={!selected || runMutation.isPending}
                      onClick={() => runMutation.mutate()}
                    >
                      {runMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                      Run
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 text-xs gap-1 text-white"
                      style={{ backgroundColor: NAVY }}
                      disabled={!selected || submitMutation.isPending}
                      onClick={() => submitMutation.mutate()}
                    >
                      {submitMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                      Submit
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className="flex-1 min-h-0">
              <MonacoEditor
                height="100%"
                language={language === 'javascript' ? 'javascript' : 'python'}
                theme="vs-dark"
                value={code}
                onChange={(v) => setCode(v ?? '')}
                options={{
                  fontSize: 13,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  padding: { top: 12 },
                  lineNumbers: 'on',
                  automaticLayout: true,
                }}
              />
            </div>

            <div className="border-t">
              <Tabs defaultValue="tests">
                <TabsList className="h-8 w-full justify-start rounded-none border-b bg-transparent px-2">
                  <TabsTrigger value="tests" className="text-xs h-7">Test Results</TabsTrigger>
                  <TabsTrigger value="console" className="text-xs h-7">Console</TabsTrigger>
                </TabsList>
                <TabsContent value="tests" className="m-0">
                  <TestResults result={runResult} loading={runMutation.isPending || submitMutation.isPending} />
                </TabsContent>
                <TabsContent value="console" className="m-0 p-3">
                  <p className="text-xs text-muted-foreground font-mono">
                    {submitStatus === 'Accepted' && (
                      <span className="text-emerald-600 flex items-center gap-1"><Trophy className="h-3.5 w-3.5" /> Accepted — solution recorded in gradebook.</span>
                    )}
                    {submitStatus && submitStatus !== 'Accepted' && (
                      <span className="text-amber-600 flex items-center gap-1"><AlertCircle className="h-3.5 w-3.5" /> {submitStatus} — fix failing cases and submit again.</span>
                    )}
                    {!submitStatus && 'Run your code against sample test cases before submitting.'}
                  </p>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}
