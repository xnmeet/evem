import { VersionType } from '../types/change-file';

export const typeOrder: Record<VersionType, number> = {
  none: 0,
  patch: 1,
  minor: 2,
  major: 3
};
