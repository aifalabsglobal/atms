'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  speakAttendanceSummary,
  useStudentAttendanceStatus,
} from '@/hooks/use-student-attendance-status';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function classifyIntent(transcript: string): 'status' | 'mark' | 'help' {
  const t = transcript.toLowerCase().trim();
  if (
    /\b(mark|check[\s-]?in|present|punch)\b/.test(t) ||
    /\bmark (my )?attendance\b/.test(t)
  ) {
    return 'mark';
  }
  if (
    /\b(marked|status|attendance|am i|did i|any session|sessions)\b/.test(t) ||
    /\bam i marked\b/.test(t)
  ) {
    return 'status';
  }
  return 'help';
}

/**
 * Student voice FAB: ask “Am I marked?” (status) or “Mark attendance” (handoff to Attendance UI).
 */
export function VoiceAttendanceFab() {
  const { toast } = useToast();
  const setActiveSection = useAppStore((s) => s.setActiveSection);
  const { data, refetch, isFetching } = useStudentAttendanceStatus(true);
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const [lastHeard, setLastHeard] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setSupported(!!getSpeechRecognitionCtor());
    return () => {
      recognitionRef.current?.abort();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const handleTranscript = useCallback(
    async (transcript: string) => {
      const cleaned = transcript.trim();
      if (!cleaned) return;
      setLastHeard(cleaned);
      const intent = classifyIntent(cleaned);

      if (intent === 'help') {
        const help =
          'Try saying: Am I marked? Or: Mark my attendance.';
        speakAttendanceSummary(help);
        toast({ title: 'Voice help', description: help });
        return;
      }

      if (intent === 'mark') {
        const refreshed = await refetch();
        const open = refreshed.data?.open ?? data?.open ?? [];
        setActiveSection('attendance');
        if (open.length === 0) {
          const msg =
            refreshed.data?.summary ??
            data?.summary ??
            'No open sessions to mark. Opening Attendance.';
          speakAttendanceSummary(msg);
          toast({ title: 'Attendance', description: msg });
          return;
        }
        const msg =
          open.length === 1
            ? `Opening Attendance for ${open[0].course.code || open[0].course.name}. Finish with location and selfie.`
            : `You have ${open.length} open sessions. Opening Attendance so you can choose one.`;
        speakAttendanceSummary(msg);
        toast({ title: 'Mark attendance', description: msg });
        return;
      }

      const refreshed = await refetch();
      const summary =
        refreshed.data?.summary ?? data?.summary ?? 'Could not load attendance status.';
      speakAttendanceSummary(summary);
      toast({ title: 'Attendance status', description: summary });
    },
    [data?.open, data?.summary, refetch, setActiveSection, toast],
  );

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const startListening = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      setSupported(false);
      toast({
        title: 'Voice not supported',
        description: 'Use Chrome or Edge for speech recognition.',
        variant: 'destructive',
      });
      return;
    }

    try {
      recognitionRef.current?.abort();
      const recognition = new Ctor();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-IN';
      recognition.onresult = (event) => {
        const transcript = event.results?.[0]?.[0]?.transcript ?? '';
        void handleTranscript(transcript);
      };
      recognition.onerror = (event) => {
        setListening(false);
        if (event.error === 'not-allowed') {
          toast({
            title: 'Microphone blocked',
            description: 'Allow microphone access to use voice attendance.',
            variant: 'destructive',
          });
          return;
        }
        if (event.error !== 'aborted' && event.error !== 'no-speech') {
          toast({
            title: 'Voice error',
            description: event.error ?? 'Could not hear you',
            variant: 'destructive',
          });
        }
      };
      recognition.onend = () => setListening(false);
      recognitionRef.current = recognition;
      recognition.start();
      setListening(true);
    } catch {
      setListening(false);
      toast({
        title: 'Voice error',
        description: 'Could not start the microphone.',
        variant: 'destructive',
      });
    }
  }, [handleTranscript, toast]);

  const toggle = () => {
    if (listening) stopListening();
    else startListening();
  };

  if (!supported) return null;

  return (
    <div className="fixed bottom-20 right-4 z-40 flex flex-col items-end gap-2 md:bottom-6">
      {lastHeard && (
        <p className="max-w-[220px] rounded-md border bg-background/95 px-2.5 py-1.5 text-[11px] text-muted-foreground shadow-sm">
          Heard: <span className="text-foreground">{lastHeard}</span>
        </p>
      )}
      <Button
        type="button"
        size="icon"
        aria-label={listening ? 'Stop listening' : 'Ask attendance by voice'}
        aria-pressed={listening}
        onClick={toggle}
        className={cn(
          'h-12 w-12 rounded-full shadow-lg',
          listening
            ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
            : 'bg-brand text-white hover:bg-brand/90',
        )}
      >
        {isFetching && !listening ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : listening ? (
          <MicOff className="h-5 w-5" />
        ) : (
          <Mic className="h-5 w-5" />
        )}
      </Button>
    </div>
  );
}
