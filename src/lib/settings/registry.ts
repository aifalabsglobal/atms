import type { SettingDefinition, SettingCategory } from './types';
import { cloneDefaultMatrix } from '@/lib/rbac-defaults';
import { BRAND } from '@/lib/branding';
import { isAssetUrl, normalizeAssetUrl } from './asset-url';

const defs: SettingDefinition[] = [
  // General — Branding
  {
    key: 'general.app_name',
    category: 'general',
    subcategory: 'Branding',
    displayName: 'Campus product name',
    description:
      'Short name shown in the sidebar header, browser tab, login screen, and PDF report titles (e.g. AIMSCS).',
    valueType: 'string',
    defaultValue: BRAND.name,
    validation: { required: true },
  },
  {
    key: 'general.tagline',
    category: 'general',
    subcategory: 'Branding',
    displayName: 'Tagline',
    description: 'One-line subtitle under the product name on login and in the header (e.g. Smart Campus Management System).',
    valueType: 'string',
    defaultValue: BRAND.tagline,
  },
  {
    key: 'general.company_name',
    category: 'general',
    subcategory: 'Branding',
    displayName: 'Institute / organization name',
    description:
      'Full legal or institute name used in the page footer and exported PDF headers.',
    valueType: 'string',
    defaultValue: BRAND.fullOrgName,
  },
  {
    key: 'general.logo_url',
    category: 'general',
    subcategory: 'Branding',
    displayName: 'Logo image URL',
    description:
      'Campus logo in the header and login card. Upload an image (saved to public/branding or S3) or paste a public path / https URL.',
    valueType: 'string',
    defaultValue: BRAND.logoSrc,
  },
  {
    key: 'general.favicon_url',
    category: 'general',
    subcategory: 'Branding',
    displayName: 'Browser tab icon URL',
    description:
      'Favicon for the browser tab. Use a public path (e.g. /logo.jpeg) or a full https:// image URL.',
    valueType: 'string',
    defaultValue: BRAND.logoSrc,
  },
  {
    key: 'general.branding_primary_color',
    category: 'general',
    subcategory: 'Branding',
    displayName: 'Brand accent color',
    description:
      'Hex color (#RRGGBB) used for header titles, login accents, and primary UI highlights. Example: #1A3C6E.',
    valueType: 'string',
    defaultValue: '#1A3C6E',
    validation: { regex: '^#[0-9A-Fa-f]{6}$' },
  },
  {
    key: 'general.copyright_text',
    category: 'general',
    subcategory: 'Branding',
    displayName: 'Footer copyright line',
    description: 'Text shown in the bottom footer of the main app shell.',
    valueType: 'string',
    defaultValue: BRAND.copyright,
  },

  // General — Regional & formats
  {
    key: 'general.timezone',
    category: 'general',
    subcategory: 'Regional & formats',
    displayName: 'Campus timezone',
    description:
      'IANA timezone for campus date/time display (LMS due dates, user dates, and other campus-formatted timestamps).',
    valueType: 'enum',
    defaultValue: 'Asia/Kolkata',
    validation: {
      allowedValues: [
        'Asia/Kolkata',
        'Asia/Dubai',
        'Asia/Singapore',
        'UTC',
        'Europe/London',
        'America/New_York',
      ],
      optionLabels: {
        'Asia/Kolkata': 'India (Asia/Kolkata) — IST',
        'Asia/Dubai': 'UAE (Asia/Dubai) — GST',
        'Asia/Singapore': 'Singapore (Asia/Singapore)',
        UTC: 'UTC (Coordinated Universal Time)',
        'Europe/London': 'UK (Europe/London)',
        'America/New_York': 'US Eastern (America/New_York)',
      },
    },
  },
  {
    key: 'general.locale',
    category: 'general',
    subcategory: 'Regional & formats',
    displayName: 'Number & currency locale',
    description:
      'Controls how numbers and currency amounts are formatted (thousands separators, currency symbol placement).',
    valueType: 'enum',
    defaultValue: 'en-IN',
    validation: {
      allowedValues: ['en-IN', 'en-US', 'en-GB'],
      optionLabels: {
        'en-IN': 'English (India) — 1,00,000 style',
        'en-US': 'English (United States)',
        'en-GB': 'English (United Kingdom)',
      },
    },
  },
  {
    key: 'general.language',
    category: 'general',
    subcategory: 'Regional & formats',
    displayName: 'Interface language',
    description:
      'Sets the document language (html lang). English UI strings ship today; Hindi currently updates browser/accessibility language only until translations are added.',
    valueType: 'enum',
    defaultValue: 'en',
    validation: {
      allowedValues: ['en', 'hi'],
      optionLabels: {
        en: 'English',
        hi: 'Hindi (lang only — UI still English)',
      },
    },
  },
  {
    key: 'general.date_format',
    category: 'general',
    subcategory: 'Regional & formats',
    displayName: 'Date display format',
    description: 'How calendar dates appear in lists and reports (day, month, year order).',
    valueType: 'enum',
    defaultValue: 'dd/MM/yyyy',
    validation: {
      allowedValues: ['dd/MM/yyyy', 'MM/dd/yyyy', 'yyyy-MM-dd'],
      optionLabels: {
        'dd/MM/yyyy': 'DD/MM/YYYY — 11/07/2026 (common in India)',
        'MM/dd/yyyy': 'MM/DD/YYYY — 07/11/2026 (US style)',
        'yyyy-MM-dd': 'YYYY-MM-DD — 2026-07-11 (ISO)',
      },
    },
  },
  {
    key: 'general.time_format',
    category: 'general',
    subcategory: 'Regional & formats',
    displayName: 'Clock format',
    description: '12-hour (AM/PM) or 24-hour clock for timestamps in LMS and reports.',
    valueType: 'enum',
    defaultValue: '12h',
    validation: {
      allowedValues: ['12h', '24h'],
      optionLabels: {
        '12h': '12-hour — 2:30 PM',
        '24h': '24-hour — 14:30',
      },
    },
  },
  {
    key: 'general.currency',
    category: 'general',
    subcategory: 'Regional & formats',
    displayName: 'Currency',
    description:
      'Currency code for campus amount formatting (e.g. dashboard samples and wallet display when Knuct does not supply a currency).',
    valueType: 'enum',
    defaultValue: 'INR',
    validation: {
      allowedValues: ['INR', 'USD', 'EUR', 'GBP'],
      optionLabels: {
        INR: 'Indian Rupee (₹)',
        USD: 'US Dollar ($)',
        EUR: 'Euro (€)',
        GBP: 'British Pound (£)',
      },
    },
  },

  // General — Experience
  {
    key: 'general.theme',
    category: 'general',
    subcategory: 'Experience',
    displayName: 'Default appearance',
    description:
      'Campus light/dark mode applied after login and on the login page. Choose Light, Dark, or Match device. The header toggle can still switch for the current browser.',
    valueType: 'enum',
    defaultValue: 'light',
    validation: {
      allowedValues: ['light', 'dark', 'system'],
      optionLabels: {
        light: 'Light',
        dark: 'Dark',
        system: 'Match device (system)',
      },
    },
  },
  {
    key: 'general.landing_section',
    category: 'general',
    subcategory: 'Experience',
    displayName: 'Home screen after login',
    description:
      'Which module opens first after a successful login (if the user has access). Choose Dashboard unless you want staff to land in a specific module.',
    valueType: 'enum',
    defaultValue: 'dashboard',
    validation: {
      allowedValues: [
        'dashboard',
        'masters',
        'attendance',
        'lms',
        'users',
        'violations',
        'reports',
        'geofences',
        'calendar',
        'settings',
      ],
      optionLabels: {
        dashboard: 'Dashboard',
        masters: 'Masters (academic catalog)',
        attendance: 'Attendance',
        lms: 'Learning Management',
        users: 'Users & RBAC',
        violations: 'Violations',
        reports: 'Reports & Analytics',
        geofences: 'Geofences',
        calendar: 'Calendar',
        settings: 'Administration',
      },
    },
  },
  {
    key: 'general.pagination_default',
    category: 'general',
    subcategory: 'Experience',
    displayName: 'Rows per page (lists)',
    description:
      'Default number of rows for LMS lists, Users, Violations, and similar paginated tables (5–200).',
    valueType: 'number',
    defaultValue: 20,
    validation: { min: 5, max: 200 },
  },

  // General — Access & safety
  {
    key: 'general.session_timeout_minutes',
    category: 'general',
    subcategory: 'Access & safety',
    displayName: 'Idle logout (minutes)',
    description:
      'Automatically sign the user out after this many minutes of inactivity (client). Also caps JWT session lifetime to the same duration. Default 480 = 8 hours. Range: 15 minutes to 7 days.',
    valueType: 'number',
    defaultValue: 480,
    validation: { min: 15, max: 10080 },
  },
  {
    key: 'general.maintenance_mode',
    category: 'general',
    subcategory: 'Access & safety',
    displayName: 'Maintenance banner',
    description:
      'When On, non-admin users see a yellow banner (app + login) and mutating APIs return 503. Admins and Super Admins can still work and turn this off.',
    valueType: 'boolean',
    defaultValue: false,
  },

  // Attendance
  {
    key: 'attendance.eligibility_pct',
    category: 'attendance',
    displayName: 'Eligibility attendance %',
    description: 'Minimum attendance percentage for exam eligibility.',
    valueType: 'number',
    defaultValue: 75,
    validation: { min: 0, max: 100, required: true },
    allowDepartmentOverride: true,
  },
  {
    key: 'attendance.condonation_pct',
    category: 'attendance',
    displayName: 'Condonation attendance %',
    description: 'Lower bound for condonation consideration.',
    valueType: 'number',
    defaultValue: 65,
    validation: { min: 0, max: 100, required: true },
    allowDepartmentOverride: true,
  },
  {
    key: 'attendance.require_hod_for_condonation',
    category: 'attendance',
    displayName: 'Require HOD for condonation',
    description: 'HOD approval required for condonation requests.',
    valueType: 'boolean',
    defaultValue: true,
    allowDepartmentOverride: true,
  },

  // Policies
  {
    key: 'policies.face_verification_enforced',
    category: 'policies',
    displayName: 'Enforce face verification',
    description: 'Reject self-mark when face match fails (requires face API).',
    valueType: 'boolean',
    defaultValue: false,
  },
  {
    key: 'policies.geofence_self_mark_required',
    category: 'policies',
    displayName: 'Require geofence for self-mark',
    description: 'Students must be inside the session geofence to mark attendance.',
    valueType: 'boolean',
    defaultValue: true,
  },
  {
    key: 'policies.knuct_anchors_enabled',
    category: 'policies',
    displayName: 'Knuct anchors enabled',
    description: 'Record blockchain audit anchors for key events.',
    valueType: 'boolean',
    defaultValue: true,
  },
  {
    key: 'policies.audit_logging_enabled',
    category: 'policies',
    displayName: 'Audit logging enabled',
    description: 'Write security and admin actions to the audit log.',
    valueType: 'boolean',
    defaultValue: true,
  },

  // Geofence
  {
    key: 'geofence.default_radius_meters',
    category: 'geofence',
    displayName: 'Default geofence radius (m)',
    description: 'Default circle radius when creating geofences.',
    valueType: 'number',
    defaultValue: 100,
    validation: { min: 10, max: 5000 },
    allowDepartmentOverride: true,
  },

  // Notifications
  {
    key: 'notifications.low_attendance_warning',
    category: 'notifications',
    displayName: 'Low attendance in-app warning',
    description: 'Notify students (and parents) when attendance falls below eligibility.',
    valueType: 'boolean',
    defaultValue: true,
  },
  {
    key: 'notifications.low_attendance_email',
    category: 'notifications',
    displayName: 'Low attendance email',
    description: 'Send email/SMS for low attendance when providers are configured.',
    valueType: 'boolean',
    defaultValue: false,
  },
  {
    key: 'notifications.violation_alert',
    category: 'notifications',
    displayName: 'Violation / integrity alerts',
    description: 'Notify on failed geofence or face verification marks.',
    valueType: 'boolean',
    defaultValue: true,
  },
  {
    key: 'notifications.low_attendance_sms',
    category: 'notifications',
    displayName: 'Low attendance SMS',
    description: 'Send SMS for low attendance when Twilio is configured (separate from email).',
    valueType: 'boolean',
    defaultValue: false,
  },

  // LMS
  {
    key: 'lms.coding_enabled',
    category: 'lms',
    displayName: 'Coding quizzes enabled',
    description: 'Allow students to run and submit coding quiz problems.',
    valueType: 'boolean',
    defaultValue: true,
    allowDepartmentOverride: true,
  },
  {
    key: 'lms.coding_default_time_limit_ms',
    category: 'lms',
    displayName: 'Coding default time limit (ms)',
    description: 'Default per-test time limit for new coding problems.',
    valueType: 'number',
    defaultValue: 2000,
    validation: { min: 100, max: 30000 },
  },
  {
    key: 'lms.coding_python_enabled',
    category: 'lms',
    displayName: 'Python judging enabled',
    description: 'Allow Python submissions (JavaScript remains the default).',
    valueType: 'boolean',
    defaultValue: false,
    allowDepartmentOverride: true,
  },
  {
    key: 'lms.coding_run_rate_limit_per_min',
    category: 'lms',
    displayName: 'Coding run rate limit / min',
    description: 'Max code-run requests per user per minute.',
    valueType: 'number',
    defaultValue: 40,
    validation: { min: 5, max: 200 },
  },
  {
    key: 'lms.coding_submit_rate_limit_per_min',
    category: 'lms',
    displayName: 'Coding submit rate limit / min',
    description: 'Max code-submit requests per user per minute.',
    valueType: 'number',
    defaultValue: 15,
    validation: { min: 3, max: 100 },
  },
  {
    key: 'lms.quiz_grade_weight_pct',
    category: 'lms',
    displayName: 'Quiz gradebook weight %',
    description: 'Default weightage written to gradebook for quiz scores.',
    valueType: 'number',
    defaultValue: 15,
    validation: { min: 0, max: 100 },
    allowDepartmentOverride: true,
  },
  {
    key: 'lms.assignment_grade_weight_pct',
    category: 'lms',
    displayName: 'Assignment gradebook weight %',
    description: 'Default weightage written to gradebook for assignment scores.',
    valueType: 'number',
    defaultValue: 25,
    validation: { min: 0, max: 100 },
    allowDepartmentOverride: true,
  },
  {
    key: 'lms.default_assignment_max_score',
    category: 'lms',
    displayName: 'Default assignment max score',
    description: 'Default max score when creating assignments.',
    valueType: 'number',
    defaultValue: 100,
    validation: { min: 1, max: 1000 },
  },
  {
    key: 'lms.default_allow_late_submissions',
    category: 'lms',
    displayName: 'Allow late submissions by default',
    description: 'Default allowLate flag for new assignments.',
    valueType: 'boolean',
    defaultValue: true,
  },
  {
    key: 'lms.default_late_penalty_pct',
    category: 'lms',
    displayName: 'Default late penalty %',
    description: 'Default late penalty percentage for new assignments.',
    valueType: 'number',
    defaultValue: 0,
    validation: { min: 0, max: 100 },
  },
  {
    key: 'lms.quiz_default_points_mcq',
    category: 'lms',
    displayName: 'Default MCQ points',
    description: 'Default points for new multiple-choice quiz questions.',
    valueType: 'number',
    defaultValue: 1,
    validation: { min: 0, max: 100 },
  },
  {
    key: 'lms.quiz_default_points_coding',
    category: 'lms',
    displayName: 'Default coding points',
    description: 'Default points for new coding quiz questions.',
    valueType: 'number',
    defaultValue: 10,
    validation: { min: 0, max: 100 },
  },

  // Integrations (env mirrors — secrets stay in env)
  {
    key: 'integrations.face_verification_enabled',
    category: 'integrations',
    displayName: 'Face verification capability',
    description: 'FACE_VERIFICATION_ENABLED — whether face API may be used.',
    valueType: 'boolean',
    defaultValue: false,
    editable: false,
    envOnly: true,
    envKey: 'FACE_VERIFICATION_ENABLED',
  },
  {
    key: 'integrations.knuct_enabled',
    category: 'integrations',
    displayName: 'Knuct live enabled',
    description: 'KNUCT_ENABLED — live Knuct wallet/anchor traffic.',
    valueType: 'boolean',
    defaultValue: false,
    editable: false,
    envOnly: true,
    envKey: 'KNUCT_ENABLED',
  },
  {
    key: 'integrations.knuct_wallet_on_user_create',
    category: 'integrations',
    displayName: 'Knuct wallet on user create',
    description: 'KNUCT_WALLET_ON_USER_CREATE.',
    valueType: 'boolean',
    defaultValue: false,
    editable: false,
    envOnly: true,
    envKey: 'KNUCT_WALLET_ON_USER_CREATE',
  },
  {
    key: 'integrations.knuct_credentials_enabled',
    category: 'integrations',
    displayName: 'Knuct credentials enabled',
    description: 'KNUCT_CREDENTIALS_ENABLED.',
    valueType: 'boolean',
    defaultValue: false,
    editable: false,
    envOnly: true,
    envKey: 'KNUCT_CREDENTIALS_ENABLED',
  },
  {
    key: 'integrations.knuct_chain_publish_enabled',
    category: 'integrations',
    displayName: 'Knuct chain publish',
    description: 'KNUCT_CHAIN_PUBLISH_ENABLED.',
    valueType: 'boolean',
    defaultValue: false,
    editable: false,
    envOnly: true,
    envKey: 'KNUCT_CHAIN_PUBLISH_ENABLED',
  },
  {
    key: 'integrations.knuct_pilot_cohort_limit',
    category: 'integrations',
    displayName: 'Knuct pilot cohort limit',
    description: 'KNUCT_PILOT_COHORT_LIMIT.',
    valueType: 'number',
    defaultValue: 25,
    editable: false,
    envOnly: true,
    envKey: 'KNUCT_PILOT_COHORT_LIMIT',
  },

  // Runtime computed status (read-only)
  {
    key: 'runtime.storage_configured',
    category: 'runtime',
    displayName: 'Object storage configured',
    description: 'S3/R2 credentials present (secrets remain in env).',
    valueType: 'boolean',
    defaultValue: false,
    editable: false,
    envOnly: true,
    envKey: 'S3_BUCKET',
  },
  {
    key: 'runtime.email_configured',
    category: 'runtime',
    displayName: 'Email configured',
    description: 'Outbound email provider is configured.',
    valueType: 'boolean',
    defaultValue: false,
    editable: false,
    envOnly: true,
    envKey: 'RESEND_API_KEY',
  },
  {
    key: 'runtime.sms_configured',
    category: 'runtime',
    displayName: 'SMS configured',
    description: 'Twilio SMS credentials are configured.',
    valueType: 'boolean',
    defaultValue: false,
    editable: false,
    envOnly: true,
    envKey: 'TWILIO_ACCOUNT_SID',
  },

  // RBAC
  {
    key: 'rbac.matrix',
    category: 'rbac',
    displayName: 'Role × section matrix',
    description: 'Navigation and API section access by role.',
    valueType: 'json',
    defaultValue: cloneDefaultMatrix(),
    editable: true,
  },

  // Flags (env-only example)
  {
    key: 'flags.demo_auth_visible',
    category: 'flags',
    displayName: 'Demo auth allowed',
    description: 'Whether demo password / role switcher is allowed (from ALLOW_DEMO_AUTH / NODE_ENV).',
    valueType: 'boolean',
    defaultValue: false,
    editable: false,
    envOnly: true,
    envKey: 'ALLOW_DEMO_AUTH',
  },

  // Organization
  {
    key: 'organization.week_starts_on',
    category: 'organization',
    displayName: 'Week starts on',
    description: 'First day of the week for calendars and timetables (0=Sunday … 6=Saturday).',
    valueType: 'enum',
    defaultValue: 1,
    validation: { allowedValues: [0, 1, 2, 3, 4, 5, 6] },
  },
  {
    key: 'organization.working_days',
    category: 'organization',
    displayName: 'Working days',
    description: 'Days of week considered working days (0=Sun … 6=Sat).',
    valueType: 'json',
    defaultValue: [1, 2, 3, 4, 5],
  },
  {
    key: 'organization.holiday_block_attendance',
    category: 'organization',
    displayName: 'Block attendance on holidays',
    description: 'Reject self-mark attempts on calendar holiday dates.',
    valueType: 'boolean',
    defaultValue: false,
  },
  {
    key: 'organization.require_active_academic_year',
    category: 'organization',
    displayName: 'Require active academic year',
    description: 'Warn admins when no academic year is marked active.',
    valueType: 'boolean',
    defaultValue: true,
  },

  // User management / auth
  {
    key: 'users.password_min_length',
    category: 'users',
    displayName: 'Password minimum length',
    description: 'Minimum characters required for new or reset passwords.',
    valueType: 'number',
    defaultValue: 8,
    validation: { min: 6, max: 128 },
  },
  {
    key: 'users.password_require_uppercase',
    category: 'users',
    displayName: 'Require uppercase letter',
    description: 'Passwords must include at least one A–Z character.',
    valueType: 'boolean',
    defaultValue: false,
  },
  {
    key: 'users.password_require_number',
    category: 'users',
    displayName: 'Require number',
    description: 'Passwords must include at least one digit.',
    valueType: 'boolean',
    defaultValue: true,
  },
  {
    key: 'users.password_require_special',
    category: 'users',
    displayName: 'Require special character',
    description: 'Passwords must include a non-alphanumeric character.',
    valueType: 'boolean',
    defaultValue: false,
  },
  {
    key: 'users.max_failed_logins',
    category: 'users',
    displayName: 'Max failed logins',
    description: 'Lock the account after this many consecutive failed password attempts (0 = disabled).',
    valueType: 'number',
    defaultValue: 5,
    validation: { min: 0, max: 50 },
  },
  {
    key: 'users.lockout_minutes',
    category: 'users',
    displayName: 'Lockout duration (minutes)',
    description: 'How long a locked account stays locked after failed logins.',
    valueType: 'number',
    defaultValue: 15,
    validation: { min: 1, max: 1440 },
  },
  {
    key: 'users.self_registration_enabled',
    category: 'users',
    displayName: 'Self-registration enabled',
    description: 'Allow public /register requests (Knuct DID registration flow).',
    valueType: 'boolean',
    defaultValue: true,
  },
  {
    key: 'users.default_role',
    category: 'users',
    displayName: 'Default registration role',
    description: 'Role assigned when a registration request does not specify one.',
    valueType: 'enum',
    defaultValue: 'student',
    validation: {
      allowedValues: ['student', 'faculty', 'lab_assistant', 'parent', 'visitor'],
    },
  },
  {
    key: 'users.temp_password_length',
    category: 'users',
    displayName: 'Temp password length',
    description: 'Length of auto-generated temporary passwords for new users.',
    valueType: 'number',
    defaultValue: 10,
    validation: { min: 8, max: 32 },
  },

  // Extra LMS
  {
    key: 'lms.enrollment_capacity_default',
    category: 'lms',
    displayName: 'Default enrollment capacity',
    description: 'Soft capacity hint for new courses (0 = unlimited). Enforced when > 0.',
    valueType: 'number',
    defaultValue: 0,
    validation: { min: 0, max: 10000 },
    allowDepartmentOverride: true,
  },
  {
    key: 'lms.quiz_negative_marking',
    category: 'lms',
    displayName: 'Quiz negative marking',
    description: 'When enabled, incorrect MCQ answers can subtract points (uses penalty % below).',
    valueType: 'boolean',
    defaultValue: false,
    allowDepartmentOverride: true,
  },
  {
    key: 'lms.quiz_negative_penalty_pct',
    category: 'lms',
    displayName: 'Negative marking penalty %',
    description: 'Percent of question points deducted for a wrong MCQ answer.',
    valueType: 'number',
    defaultValue: 25,
    validation: { min: 0, max: 100 },
  },
  {
    key: 'lms.quiz_shuffle_questions',
    category: 'lms',
    displayName: 'Shuffle quiz questions',
    description: 'Randomize question order for student quiz attempts.',
    valueType: 'boolean',
    defaultValue: false,
  },
  {
    key: 'lms.apply_late_penalty_on_grade',
    category: 'lms',
    displayName: 'Apply late penalty when grading',
    description: 'Automatically reduce graded scores for late submissions using assignment late penalty %.',
    valueType: 'boolean',
    defaultValue: true,
  },

  // Extra RBAC
  {
    key: 'rbac.allow_per_user_overrides',
    category: 'rbac',
    displayName: 'Allow per-user RBAC overrides',
    description: 'When disabled, only the role matrix applies (user override UI becomes read-only).',
    valueType: 'boolean',
    defaultValue: true,
  },
  {
    key: 'rbac.show_role_hierarchy',
    category: 'rbac',
    displayName: 'Show role hierarchy hints',
    description: 'Display role hierarchy guidance in the RBAC matrix panel.',
    valueType: 'boolean',
    defaultValue: true,
  },

  // Audit & compliance
  {
    key: 'audit.retention_days',
    category: 'audit',
    displayName: 'Audit log retention (days)',
    description: 'Suggested retention window for audit logs (0 = keep forever). Used by purge tooling.',
    valueType: 'number',
    defaultValue: 365,
    validation: { min: 0, max: 3650 },
  },
  {
    key: 'audit.log_failed_logins',
    category: 'audit',
    displayName: 'Log failed logins',
    description: 'Write an audit entry when password authentication fails.',
    valueType: 'boolean',
    defaultValue: true,
  },
  {
    key: 'audit.default_anchorable_filter',
    category: 'audit',
    displayName: 'Default Audit Log filter',
    description: 'Default the Administration Audit Log tab to anchorable events only.',
    valueType: 'boolean',
    defaultValue: true,
  },

  // Extra notifications
  {
    key: 'notifications.registration_outcome',
    category: 'notifications',
    displayName: 'Registration outcome alerts',
    description: 'Notify applicants in-app when registration requests are approved or rejected.',
    valueType: 'boolean',
    defaultValue: true,
  },
  {
    key: 'notifications.dedupe_days',
    category: 'notifications',
    displayName: 'Notification dedupe window (days)',
    description: 'Suppress duplicate low-attendance / integrity alerts within this many days.',
    valueType: 'number',
    defaultValue: 7,
    validation: { min: 1, max: 90 },
  },

  // System / runtime tunables
  {
    key: 'runtime.settings_cache_ttl_seconds',
    category: 'runtime',
    displayName: 'Settings cache TTL (seconds)',
    description: 'In-process settings cache lifetime. Lower values pick up changes faster.',
    valueType: 'number',
    defaultValue: 60,
    validation: { min: 5, max: 3600 },
  },
];

const byKey = new Map(defs.map((d) => [d.key, d]));

export function listSettingDefinitions(category?: SettingCategory): SettingDefinition[] {
  const list = category ? defs.filter((d) => d.category === category) : [...defs];
  return list.filter((d) => d.visible !== false);
}

export function getSettingDefinition(key: string): SettingDefinition | undefined {
  return byKey.get(key);
}

export function requireSettingDefinition(key: string): SettingDefinition {
  const def = byKey.get(key);
  if (!def) throw new Error(`Unknown setting key: ${key}`);
  return def;
}

export function listSettingCategories(): { id: SettingCategory; label: string; keys: string[] }[] {
  const order: { id: SettingCategory; label: string }[] = [
    { id: 'general', label: 'General settings' },
    { id: 'organization', label: 'Organization' },
    { id: 'users', label: 'User management' },
    { id: 'attendance', label: 'Attendance' },
    { id: 'policies', label: 'Policies' },
    { id: 'geofence', label: 'Geofence' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'lms', label: 'LMS' },
    { id: 'integrations', label: 'Integrations' },
    { id: 'rbac', label: 'RBAC' },
    { id: 'audit', label: 'Audit & compliance' },
    { id: 'flags', label: 'Feature flags' },
    { id: 'runtime', label: 'Runtime / environment' },
  ];
  return order.map((c) => ({
    ...c,
    keys: defs.filter((d) => d.category === c.id).map((d) => d.key),
  }));
}

export function validateSettingValue(def: SettingDefinition, value: unknown): string | null {
  const v = def.validation;
  if (def.envOnly) return 'This setting is environment-only and cannot be set in the database.';
  if (def.editable === false) return 'This setting is not editable.';

  if (v?.required && (value === null || value === undefined || value === '')) {
    return 'Value is required.';
  }

  switch (def.valueType) {
    case 'boolean':
      if (typeof value !== 'boolean') return 'Expected boolean.';
      break;
    case 'number':
    case 'decimal':
      if (typeof value !== 'number' || Number.isNaN(value)) return 'Expected number.';
      if (v?.min != null && value < v.min) return `Minimum is ${v.min}.`;
      if (v?.max != null && value > v.max) return `Maximum is ${v.max}.`;
      break;
    case 'string':
    case 'secret':
      if (typeof value !== 'string') return 'Expected string.';
      if (
        def.key === 'general.logo_url' ||
        def.key === 'general.favicon_url'
      ) {
        const normalized = normalizeAssetUrl(value);
        if (!normalized || !isAssetUrl(normalized)) {
          return 'Use a public path like /logo.jpeg or a full https:// image URL.';
        }
        break;
      }
      if (v?.regex && !new RegExp(v.regex).test(value)) {
        return 'Value does not match required pattern.';
      }
      break;
    case 'enum':
      if (v?.allowedValues && !v.allowedValues.includes(value as string | number | boolean)) {
        return `Allowed values: ${v.allowedValues.join(', ')}`;
      }
      break;
    case 'json':
    case 'array':
      if (value === undefined) return 'Expected JSON value.';
      break;
    default:
      break;
  }

  if (v?.allowedValues && def.valueType !== 'enum') {
    if (!v.allowedValues.includes(value as string | number | boolean)) {
      return `Allowed values: ${v.allowedValues.join(', ')}`;
    }
  }

  if (def.key === 'attendance.eligibility_pct' || def.key === 'attendance.condonation_pct') {
    // Cross-field check happens in adapter when saving full config.
  }

  return null;
}
