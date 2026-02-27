/**
 * Static configuration data for the Home Customization form.
 * Extracted from HomeCustomizationComponent to keep the component focused on behavior.
 */

export const WELL_KNOWN_HC_LABELS = [
  'hero_description', 'sidebar_bio', 'contact_description',
  'availability_status',
  'highlight_1_value', 'highlight_1_label',
  'highlight_2_value', 'highlight_2_label',
  'highlight_3_value', 'highlight_3_label',
];

export const WORK_MODE_OPTIONS = [
  { value: 'remote', labelKey: 'resume.profile.workMode.remote' },
  { value: 'hybrid', labelKey: 'resume.profile.workMode.hybrid' },
  { value: 'onsite', labelKey: 'resume.profile.workMode.onsite' },
  { value: 'flexible', labelKey: 'resume.profile.workMode.flexible' },
];

export const AVAILABILITY_STATUS_OPTIONS = [
  { value: 'remote-opportunities', labelKey: 'resume.profile.availability.remoteOpportunities' },
  { value: 'open-to-new', labelKey: 'resume.profile.availability.openToNew' },
  { value: 'employed-open-to-offers', labelKey: 'resume.profile.availability.employedOpenToOffers' },
  { value: 'actively-looking', labelKey: 'resume.profile.availability.activelyLooking' },
  { value: 'immediately', labelKey: 'resume.profile.availability.immediately' },
  { value: 'two-weeks', labelKey: 'resume.profile.availability.twoWeeks' },
  { value: 'not-available', labelKey: 'resume.profile.availability.notAvailable' },
];

export const TIMEZONE_OPTIONS = [
  { value: 'UTC-12', labelKey: 'resume.profile.tz.utcM12' },
  { value: 'UTC-11', labelKey: 'resume.profile.tz.utcM11' },
  { value: 'UTC-10', labelKey: 'resume.profile.tz.utcM10' },
  { value: 'UTC-9', labelKey: 'resume.profile.tz.utcM9' },
  { value: 'UTC-8', labelKey: 'resume.profile.tz.utcM8' },
  { value: 'UTC-7', labelKey: 'resume.profile.tz.utcM7' },
  { value: 'UTC-6', labelKey: 'resume.profile.tz.utcM6' },
  { value: 'UTC-5', labelKey: 'resume.profile.tz.utcM5' },
  { value: 'UTC-4', labelKey: 'resume.profile.tz.utcM4' },
  { value: 'UTC-3', labelKey: 'resume.profile.tz.utcM3' },
  { value: 'UTC-2', labelKey: 'resume.profile.tz.utcM2' },
  { value: 'UTC-1', labelKey: 'resume.profile.tz.utcM1' },
  { value: 'UTC+0', labelKey: 'resume.profile.tz.utcP0' },
  { value: 'UTC+1', labelKey: 'resume.profile.tz.utcP1' },
  { value: 'UTC+2', labelKey: 'resume.profile.tz.utcP2' },
  { value: 'UTC+3', labelKey: 'resume.profile.tz.utcP3' },
  { value: 'UTC+4', labelKey: 'resume.profile.tz.utcP4' },
  { value: 'UTC+5', labelKey: 'resume.profile.tz.utcP5' },
  { value: 'UTC+5:30', labelKey: 'resume.profile.tz.utcP530' },
  { value: 'UTC+6', labelKey: 'resume.profile.tz.utcP6' },
  { value: 'UTC+7', labelKey: 'resume.profile.tz.utcP7' },
  { value: 'UTC+8', labelKey: 'resume.profile.tz.utcP8' },
  { value: 'UTC+9', labelKey: 'resume.profile.tz.utcP9' },
  { value: 'UTC+10', labelKey: 'resume.profile.tz.utcP10' },
  { value: 'UTC+11', labelKey: 'resume.profile.tz.utcP11' },
  { value: 'UTC+12', labelKey: 'resume.profile.tz.utcP12' },
];

export const EMPLOYMENT_TYPE_OPTIONS = [
  { value: 'full-time', labelKey: 'resume.profile.employmentType.fullTime' },
  { value: 'part-time', labelKey: 'resume.profile.employmentType.partTime' },
  { value: 'contract', labelKey: 'resume.profile.employmentType.contract' },
  { value: 'freelance', labelKey: 'resume.profile.employmentType.freelance' },
  { value: 'internship', labelKey: 'resume.profile.employmentType.internship' },
];
