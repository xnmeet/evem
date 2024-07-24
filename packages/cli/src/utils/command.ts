import { success } from '@evem/logger';
export const cancelFlow = (): void => {
  success('Cancelled... 👋 ');
  process.exit();
};
