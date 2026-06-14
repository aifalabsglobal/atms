'use client';

import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Users, BookOpen, ScanLine, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAppStore, type Section } from '@/lib/store';

type SearchResult = {
  users: { id: string; name: string; email: string; role: string; department: string | null }[];
  courses: { id: string; name: string; code: string }[];
  sessions: { id: string; sessionDate: string; course: { name: string; code: string } }[];
  query: string;
};

export function GlobalSearch({ onNavigate }: { onNavigate?: (section: Section) => void }) {
  const { setActiveSection } = useAppStore();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isFetching } = useQuery<SearchResult>({
    queryKey: ['global-search', debounced],
    queryFn: () =>
      fetch(`/api/search?q=${encodeURIComponent(debounced)}`).then((r) => {
        if (!r.ok) throw new Error('Search failed');
        return r.json();
      }),
    enabled: debounced.length >= 2,
    staleTime: 10_000,
  });

  const navigate = useCallback(
    (section: Section) => {
      setActiveSection(section);
      onNavigate?.(section);
      setOpen(false);
      setQuery('');
    },
    [setActiveSection, onNavigate]
  );

  const hasResults =
    (data?.users?.length ?? 0) > 0 ||
    (data?.courses?.length ?? 0) > 0 ||
    (data?.sessions?.length ?? 0) > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search students, courses, sessions..."
            className="pl-9 h-9 bg-muted/50"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!open) setOpen(true);
            }}
            onFocus={() => setOpen(true)}
          />
          {isFetching && (
            <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandList>
            {debounced.length < 2 ? (
              <CommandEmpty>Type at least 2 characters to search</CommandEmpty>
            ) : !hasResults && !isFetching ? (
              <CommandEmpty>No results for &ldquo;{debounced}&rdquo;</CommandEmpty>
            ) : (
              <>
                {(data?.users?.length ?? 0) > 0 && (
                  <CommandGroup heading="Users">
                    {data!.users.map((u) => (
                      <CommandItem
                        key={u.id}
                        value={`user-${u.id}`}
                        onSelect={() => navigate('users')}
                        className="flex items-center gap-2"
                      >
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="text-sm truncate">{u.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {(data?.courses?.length ?? 0) > 0 && (
                  <CommandGroup heading="Courses">
                    {data!.courses.map((c) => (
                      <CommandItem
                        key={c.id}
                        value={`course-${c.id}`}
                        onSelect={() => navigate('lms')}
                        className="flex items-center gap-2"
                      >
                        <BookOpen className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm truncate">{c.code} — {c.name}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
                {(data?.sessions?.length ?? 0) > 0 && (
                  <CommandGroup heading="Attendance Sessions">
                    {data!.sessions.map((s) => (
                      <CommandItem
                        key={s.id}
                        value={`session-${s.id}`}
                        onSelect={() => navigate('attendance')}
                        className="flex items-center gap-2"
                      >
                        <ScanLine className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-sm truncate">
                          {s.sessionDate} — {s.course.code}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
