export type {
  SettingScope,
  SettingValueType,
  SettingCategory,
  SettingDefinition,
  EffectiveSetting,
  SetSettingOptions,
} from './types';

export {
  listSettingDefinitions,
  getSettingDefinition,
  listSettingCategories,
  validateSettingValue,
} from './registry';

export {
  getSetting,
  getEffectiveSetting,
  getByCategory,
  listAllSettings,
  setSetting,
  resetSetting,
  resetCategory,
  clearSettingOverride,
  getSettingHistory,
  rollbackSetting,
  exportSettings,
  importSettings,
  getCategories,
  addFavorite,
  removeFavorite,
  listFavorites,
  touchRecent,
  listRecent,
  getGlobalNumber,
  getGlobalBoolean,
  getGlobalString,
} from './service';

export { settingsCacheInvalidate } from './cache';
export { resolveEffectiveValue } from './resolve';
export { getLmsSettings, DEFAULT_LMS_SETTINGS, type LmsSettings } from './lms-config';
export {
  getGeneralSettings,
  DEFAULT_GENERAL_SETTINGS,
  type GeneralSettings,
} from './general-config';
export {
  getAuthSettings,
  validatePasswordAgainstPolicy,
  getLoginLockState,
  recordLoginFailure,
  clearLoginFailures,
  DEFAULT_AUTH_SETTINGS,
  type AuthSettings,
} from './auth-config';
export {
  parseIdentityMode,
  isKnuctUiEnabled,
  isKnuctLoginVisible,
  preferKnuctLogin,
  formatIdentityModePreview,
  knuctPolicyBlockedMessage,
  DEFAULT_IDENTITY_MODE,
  IDENTITY_MODE_LABELS,
  type IdentityMode,
} from './identity-mode';
export { getIdentityMode } from './identity-mode-server';
export {
  getOrgSettings,
  isNonWorkingDay,
  DEFAULT_ORG_SETTINGS,
  type OrgSettings,
} from './org-config';
