import { spawnSync } from 'child_process';
import type child_process from 'child_process';
import { debug } from '@evem/logger';

export function processResult(result: child_process.SpawnSyncReturns<Buffer>): void {
  if (result.error) {
    result.error.message += result.stderr ? result.stderr.toString() : '';
    throw result.error;
  }
  if (result.status) {
    throw new Error(
      `The command failed with exit code ${result.status}${
        result.stderr ? '\n' + result.stderr.toString() : ''
      }`
    );
  }
}

export function executeCommand(command: string, args: string[], workingDirectory?: string): string {
  if (!workingDirectory) {
    workingDirectory = process.cwd();
  }

  const options = {
    cwd: workingDirectory,
    shell: true,
    // Set default max buffer size to 10MB
    maxBuffer: 10 * 1024 * 1024
  };

  debug(`* EXECUTING: ${command} ${args.join(' ')} (cwd:${workingDirectory})`);

  const result = spawnSync(command, args, options);
  processResult(result);
  return result.stdout.toString();
}
