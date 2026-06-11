'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Settings as SettingsIcon, Shield, Bell, Database, Server,
  ScanFace, MapPin, Clock, Lock, Globe, Cpu, CheckCircle, X as XIcon
} from 'lucide-react';

const roles = ['super_admin', 'admin', 'hod', 'faculty', 'lab_assistant', 'student', 'parent', 'visitor', 'security'];
const roleLabels: Record<string, string> = {
  super_admin: 'Super Admin', admin: 'Admin', hod: 'HOD', faculty: 'Faculty',
  lab_assistant: 'Lab Asst.', student: 'Student', parent: 'Parent', visitor: 'Visitor', security: 'Security'
};
const roleColors: Record<string, string> = {
  super_admin: 'bg-red-100 text-red-800', admin: 'bg-orange-100 text-orange-800',
  hod: 'bg-purple-100 text-purple-800', faculty: 'bg-blue-100 text-blue-800',
  lab_assistant: 'bg-teal-100 text-teal-800', student: 'bg-green-100 text-green-800',
  parent: 'bg-amber-100 text-amber-800', visitor: 'bg-gray-100 text-gray-800',
  security: 'bg-rose-100 text-rose-800'
};

const modules = [
  { name: 'Dashboard', key: 'dashboard' },
  { name: 'Attendance Sessions', key: 'attendance' },
  { name: 'Mark Attendance', key: 'mark_attendance' },
  { name: 'Face Recognition', key: 'face_recognition' },
  { name: 'GPS Geofencing', key: 'gps_geofencing' },
  { name: 'Course Management', key: 'courses' },
  { name: 'Assignment Mgmt', key: 'assignments' },
  { name: 'Quiz Management', key: 'quizzes' },
  { name: 'Grade Book', key: 'gradebook' },
  { name: 'User Management', key: 'users' },
  { name: 'Violation Review', key: 'violations' },
  { name: 'Reports & Analytics', key: 'reports' },
  { name: 'Geofence Config', key: 'geofence_config' },
  { name: 'System Settings', key: 'system_settings' },
  { name: 'Audit Logs', key: 'audit_logs' },
];

// Permission matrix: role -> module -> hasAccess
const permissionMatrix: Record<string, Record<string, boolean>> = {
  super_admin: Object.fromEntries(modules.map(m => [m.key, true])),
  admin: Object.fromEntries(modules.map(m => [m.key, m.key !== 'system_settings'])),
  hod: Object.fromEntries(modules.map(m => [m.key, ['dashboard', 'attendance', 'mark_attendance', 'courses', 'assignments', 'quizzes', 'gradebook', 'users', 'violations', 'reports'].includes(m.key)])),
  faculty: Object.fromEntries(modules.map(m => [m.key, ['dashboard', 'attendance', 'mark_attendance', 'face_recognition', 'courses', 'assignments', 'quizzes', 'gradebook', 'reports'].includes(m.key)])),
  lab_assistant: Object.fromEntries(modules.map(m => [m.key, ['dashboard', 'attendance', 'mark_attendance', 'face_recognition', 'gps_geofencing'].includes(m.key)])),
  student: Object.fromEntries(modules.map(m => [m.key, ['dashboard', 'mark_attendance', 'gps_geofencing', 'courses', 'assignments', 'quizzes', 'gradebook'].includes(m.key)])),
  parent: Object.fromEntries(modules.map(m => [m.key, ['dashboard', 'attendance', 'reports'].includes(m.key)])),
  visitor: Object.fromEntries(modules.map(m => [m.key, ['dashboard'].includes(m.key)])),
  security: Object.fromEntries(modules.map(m => [m.key, ['dashboard', 'attendance', 'mark_attendance', 'face_recognition'].includes(m.key)])),
};

const systemConfig = [
  { label: 'Face Recognition Model', value: 'ArcFace (DeepFace)', icon: ScanFace, status: 'active' },
  { label: 'Face Match Threshold', value: '0.92 (cosine similarity)', icon: ScanFace, status: 'active' },
  { label: 'GPS Geofencing Engine', value: 'Haversine + Shapely', icon: MapPin, status: 'active' },
  { label: 'Anti-Spoofing', value: 'MaxMind GeoIP2', icon: Shield, status: 'active' },
  { label: 'Min Attendance (Regulation)', value: '75% for eligibility', icon: Clock, status: 'active' },
  { label: 'Condonation Threshold', value: '65% with HOD approval', icon: Clock, status: 'active' },
  { label: 'Auth Method', value: 'JWT RS256 + Refresh Tokens', icon: Lock, status: 'active' },
  { label: 'Access Token Expiry', value: '15 minutes', icon: Clock, status: 'active' },
  { label: 'Rate Limiting', value: '100 req/min per user', icon: Globe, status: 'active' },
  { label: 'Database', value: 'PostgreSQL 16 + pgvector', icon: Database, status: 'active' },
  { label: 'Cache Layer', value: 'Redis 7', icon: Cpu, status: 'active' },
  { label: 'API Version', value: 'v1 (/api/v1/)', icon: Server, status: 'active' },
];

export default function SettingsSection() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1A3C6E]">System Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Configure system parameters, view RBAC matrix, and manage integrations</p>
      </div>

      <Tabs defaultValue="config" className="space-y-4">
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="rbac">RBAC Matrix</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        {/* System Configuration */}
        <TabsContent value="config" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {systemConfig.map(cfg => {
              const Icon = cfg.icon;
              return (
                <Card key={cfg.label}>
                  <CardContent className="p-4 flex items-start gap-3">
                    <div className="h-9 w-9 rounded-lg bg-[#1A3C6E]/10 flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-[#1A3C6E]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{cfg.label}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{cfg.value}</p>
                    </div>
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 shrink-0 text-[10px]">
                      <CheckCircle className="h-3 w-3 mr-1" /> Active
                    </Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* RBAC Permission Matrix */}
        <TabsContent value="rbac" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4 text-[#1A3C6E]" /> Role-Based Access Control Matrix</CardTitle>
              <CardDescription>9-role hierarchy with granular permission control across 15 modules</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 bg-card z-10 min-w-[160px]">Module</TableHead>
                      {roles.map(role => (
                        <TableHead key={role} className="text-center min-w-[80px]">
                          <Badge className={`${roleColors[role]} text-[10px] whitespace-nowrap`}>{roleLabels[role]}</Badge>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modules.map(mod => (
                      <TableRow key={mod.key}>
                        <TableCell className="sticky left-0 bg-card z-10 font-medium text-sm">{mod.name}</TableCell>
                        {roles.map(role => {
                          const hasAccess = permissionMatrix[role]?.[mod.key] || false;
                          return (
                            <TableCell key={role} className="text-center">
                              {hasAccess ? (
                                <CheckCircle className="h-4 w-4 text-green-600 mx-auto" />
                              ) : (
                                <XIcon className="h-4 w-4 text-gray-300 mx-auto" />
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Role Hierarchy */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Role Hierarchy</CardTitle>
              <CardDescription>Permission inheritance from highest to lowest</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 items-center">
                {roles.map((role, i) => (
                  <div key={role} className="flex items-center gap-2">
                    <Badge className={`${roleColors[role]} font-medium`}>{roleLabels[role]}</Badge>
                    {i < roles.length - 1 && <span className="text-muted-foreground text-sm">→</span>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notification Settings */}
        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Bell className="h-4 w-4 text-[#1A3C6E]" /> Notification Channels</CardTitle>
              <CardDescription>4 channels: SMS, Email, Push, In-App</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {[
                  { channel: 'In-App', status: 'Active', provider: 'Built-in', events: 'All events' },
                  { channel: 'Email', status: 'Active', provider: 'SMTP (UoH Mail)', events: 'Grades, Alerts, Announcements' },
                  { channel: 'SMS', status: 'Configured', provider: 'Twilio', events: 'Critical alerts only' },
                  { channel: 'Push', status: 'Active', provider: 'Firebase FCM', events: 'Attendance, Deadlines' },
                ].map(ch => (
                  <div key={ch.channel} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{ch.channel}</span>
                      <Badge variant="outline" className="bg-green-50 text-green-700 text-[10px]">{ch.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">Provider: {ch.provider}</p>
                    <p className="text-sm text-muted-foreground">Events: {ch.events}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notification Rules</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { rule: 'Low attendance warning (< 75%)', channels: 'In-App + Email + SMS', target: 'Student + Parent + HOD' },
                  { rule: 'Attendance marked successfully', channels: 'In-App', target: 'Student' },
                  { rule: 'Assignment due reminder (3 days)', channels: 'In-App + Push', target: 'Student' },
                  { rule: 'Grade published', channels: 'In-App + Email', target: 'Student' },
                  { rule: 'Violation detected', channels: 'In-App + Email + SMS', target: 'HOD + Admin + Security' },
                  { rule: 'New enrollment', channels: 'In-App + Email', target: 'Faculty' },
                ].map(r => (
                  <div key={r.rule} className="flex items-center justify-between border-b pb-3">
                    <div>
                      <p className="text-sm font-medium">{r.rule}</p>
                      <p className="text-xs text-muted-foreground">Channels: {r.channels}</p>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">{r.target}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
