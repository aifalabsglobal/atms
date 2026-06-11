'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { MapPin, Plus, Building2, Circle, Pentagon, ToggleLeft, ToggleRight } from 'lucide-react';
import type { GeofenceItem } from '@/lib/types';

export default function GeofencesSection() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newFence, setNewFence] = useState({ name: '', type: 'circle', centerLat: '17.4563', centerLng: '78.6698', radiusMtrs: '200', building: '', floor: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['geofences'],
    queryFn: () => fetch('/api/geofences').then(r => r.json()) as Promise<{ geofences: GeofenceItem[] }>,
  });

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch('/api/geofences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['geofences'] });
      setShowCreate(false);
      setNewFence({ name: '', type: 'circle', centerLat: '17.4563', centerLng: '78.6698', radiusMtrs: '200', building: '', floor: '' });
    },
  });

  const geofences = data?.geofences || [];
  const activeCount = geofences.filter(g => g.isActive).length;
  const circleCount = geofences.filter(g => g.type === 'circle').length;
  const polygonCount = geofences.filter(g => g.type === 'polygon').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1A3C6E]">Geofence Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage GPS geofence boundaries for attendance capture</p>
        </div>
        <Button className="gap-2 bg-[#1A3C6E] hover:bg-[#1A3C6E]/90" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" /> New Geofence
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#1A3C6E]/10 flex items-center justify-center"><MapPin className="h-5 w-5 text-[#1A3C6E]" /></div>
            <div><p className="text-xs text-muted-foreground">Total Geofences</p><p className="text-xl font-bold">{geofences.length}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-100 flex items-center justify-center"><ToggleRight className="h-5 w-5 text-green-600" /></div>
            <div><p className="text-xs text-muted-foreground">Active</p><p className="text-xl font-bold">{activeCount}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center"><Circle className="h-5 w-5 text-blue-600" /></div>
            <div><p className="text-xs text-muted-foreground">Circle Type</p><p className="text-xl font-bold">{circleCount}</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center"><Pentagon className="h-5 w-5 text-purple-600" /></div>
            <div><p className="text-xs text-muted-foreground">Polygon Type</p><p className="text-xl font-bold">{polygonCount}</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Geofence Map Placeholder + List */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Campus Map View</CardTitle>
            <CardDescription>Geofence boundaries on campus map</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="aspect-square bg-muted/30 rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-3">
              <MapPin className="h-12 w-12 text-[#1A3C6E]/30" />
              <p className="text-sm text-muted-foreground">Interactive Map</p>
              <p className="text-xs text-muted-foreground">Google Maps integration required</p>
              <div className="mt-2 space-y-1">
                {geofences.slice(0, 4).map(g => (
                  <div key={g.id} className="flex items-center gap-2 text-xs">
                    <div className={`h-3 w-3 rounded-full ${g.isActive ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <span>{g.name}</span>
                    {g.centerLat && <span className="text-muted-foreground">({g.centerLat.toFixed(4)}, {g.centerLng?.toFixed(4)})</span>}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Geofence List</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Building</TableHead>
                    <TableHead>Radius</TableHead>
                    <TableHead>Sessions</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                  ) : geofences.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No geofences found</TableCell></TableRow>
                  ) : (
                    geofences.map(g => (
                      <TableRow key={g.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-[#1A3C6E]" />
                            <span className="font-medium">{g.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="gap-1">
                            {g.type === 'circle' ? <Circle className="h-3 w-3" /> : <Pentagon className="h-3 w-3" />}
                            {g.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{g.building || '-'}</TableCell>
                        <TableCell className="text-sm">{g.radiusMtrs ? `${g.radiusMtrs}m` : '-'}</TableCell>
                        <TableCell className="text-sm">{g._count.attendanceSessions}</TableCell>
                        <TableCell>
                          <Badge className={g.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'} variant="secondary">
                            {g.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Create Geofence Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[#1A3C6E]">Create New Geofence</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Name</Label><Input value={newFence.name} onChange={e => setNewFence(p => ({ ...p, name: e.target.value }))} placeholder="e.g., New Science Block" /></div>
            <div><Label>Type</Label>
              <Select value={newFence.type} onValueChange={v => setNewFence(p => ({ ...p, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="circle">Circle</SelectItem><SelectItem value="polygon">Polygon</SelectItem></SelectContent>
              </Select>
            </div>
            {newFence.type === 'circle' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Center Latitude</Label><Input value={newFence.centerLat} onChange={e => setNewFence(p => ({ ...p, centerLat: e.target.value }))} /></div>
                  <div><Label>Center Longitude</Label><Input value={newFence.centerLng} onChange={e => setNewFence(p => ({ ...p, centerLng: e.target.value }))} /></div>
                </div>
                <div><Label>Radius (meters)</Label><Input value={newFence.radiusMtrs} onChange={e => setNewFence(p => ({ ...p, radiusMtrs: e.target.value }))} /></div>
              </>
            )}
            <div><Label>Building</Label><Input value={newFence.building} onChange={e => setNewFence(p => ({ ...p, building: e.target.value }))} placeholder="e.g., CSE Building" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button className="bg-[#1A3C6E] hover:bg-[#1A3C6E]/90" onClick={() => createMutation.mutate({
              name: newFence.name, type: newFence.type,
              centerLat: parseFloat(newFence.centerLat), centerLng: parseFloat(newFence.centerLng),
              radiusMtrs: parseFloat(newFence.radiusMtrs), building: newFence.building, isActive: true,
            })} disabled={!newFence.name || createMutation.isPending}>
              Create Geofence
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState } from 'react';
