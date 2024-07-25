export function resetEnv(): void {
  process.env.EVEM_LIST = '';
  process.env.EVEM_SILENT = '';
  process.env.EVEM_VERBOSE = '';
}
