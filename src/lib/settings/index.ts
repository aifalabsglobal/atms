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
