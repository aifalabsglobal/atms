-- Timetable production indexes and active-session uniqueness guard
CREATE INDEX IF NOT EXISTS "TimetableSlot_courseId_dayOfWeek_isActive_idx" ON "TimetableSlot"("courseId", "dayOfWeek", "isActive");
CREATE INDEX IF NOT EXISTS "TimetableSlot_semesterId_idx" ON "TimetableSlot"("semesterId");
CREATE INDEX IF NOT EXISTS "TimetableSlot_academicYear_idx" ON "TimetableSlot"("academicYear");
CREATE INDEX IF NOT EXISTS "AttendanceSession_timetableSlotId_sessionDate_status_idx" ON "AttendanceSession"("timetableSlotId", "sessionDate", "status");
CREATE INDEX IF NOT EXISTS "AttendanceSession_courseId_sessionDate_status_idx" ON "AttendanceSession"("courseId", "sessionDate", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "AttendanceSession_active_slot_date_key"
  ON "AttendanceSession"("timetableSlotId", "sessionDate")
  WHERE "status" = 'active' AND "timetableSlotId" IS NOT NULL;
