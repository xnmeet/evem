import spawn from 'spawndamnit';
import { executeCommand } from './execute-command';

/**
 * Serialization diff results as a list of file names
 */
function serializeFilesName(output: string): string[] {
  return output
    .split('\n')
    .map((line) => {
      if (line) {
        const trimmedLine = line.trim();
        return trimmedLine;
      }
      return '';
    })
    .filter((line) => {
      return line && line.length > 0;
    });
}

export const git = {
  add: (args: string[], cwd?: string): void => {
    spawn('git', ['add', ...args], { cwd });
  },

  tag: (tag: string, cwd?: string): void => {
    spawn('git', ['tag', '-a', tag, '-m', tag], { cwd });
  },

  branch(cwd?: string): string {
    const output = executeCommand('git', ['symbolic-ref', '--short', 'HEAD'], cwd);
    return output.trim();
  },

  isShallowRepository(cwd?: string): boolean {
    const result = executeCommand('git', ['rev-parse', '--is-shallow-repository'], cwd);
    return result.trim() === 'true';
  },

  getChangedFiles(targetBranch: string, cwd?: string): string[] {
    const output: string = executeCommand(
      'git',
      ['diff', `${targetBranch}...`, '--name-only', '--no-renames', '--diff-filter=AMRC'],
      cwd
    );
    return serializeFilesName(output);
  },
  isGitRepo(cwd?: string): boolean {
    try {
      executeCommand('git', ['status'], cwd);
      return true;
    } catch (e) {
      return false;
    }
  },
  isBranchExist(branch: string, cwd?: string): boolean {
    try {
      executeCommand('git', ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`], cwd);
      return true;
    } catch (e) {
      return false;
    }
  }
};
