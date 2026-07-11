export type ExamDayAttendancePolicy = 'allowed' | 'blocked' | 'optional';
export type SaturdayMode = 'full' | 'half' | 'off' | 'alternate';

export type OrgSettings = {
  weekStartsOn: number;
  workingDays: number[];
  holidayBlockAttendance: boolean;
  dayStartTime: string;
  dayEndTime: string;
  enforceDayHours: boolean;
  saturdayMode: SaturdayMode;
  halfDayEndTime: string;
  examDayAttendance: ExamDayAttendancePolicy;
  periodMinutes: number;
  breakMinutes: number;
  periodsPerDay: number;
  requireActiveAcademicYear: boolean;
  allowMultipleActiveYears: boolean;
  defaultRegulation: string;
  lockCompletedAcademicYears: boolean;
  requireSemesterForPublish: boolean;
  autoPromoteAcademicYear: boolean;
  campusCode: string;
  aisheCode: string;
  campusAddress: string;
  campusPhone: string;
  principalTitle: string;
};

export const DEFAULT_ORG_SETTINGS: OrgSettings = {
  weekStartsOn: 1,
  workingDays: [1, 2, 3, 4, 5],
  holidayBlockAttendance: false,
  dayStartTime: '08:00',
  dayEndTime: '17:00',
  enforceDayHours: false,
  saturdayMode: 'off',
  halfDayEndTime: '13:00',
  examDayAttendance: 'allowed',
  periodMinutes: 50,
  breakMinutes: 10,
  periodsPerDay: 6,
  requireActiveAcademicYear: true,
  allowMultipleActiveYears: false,
  defaultRegulation: 'R22',
  lockCompletedAcademicYears: true,
  requireSemesterForPublish: false,
  autoPromoteAcademicYear: false,
  campusCode: '',
  aisheCode: '',
  campusAddress: '',
  campusPhone: '',
  principalTitle: '',
};
