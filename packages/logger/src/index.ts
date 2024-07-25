import chalk from 'chalk';
import util from 'util';
import readline from 'readline';

export function dynamicLog(output: string) {
  let seconds = 0;
  let latestSuffix = '';
  let timer: any;

  return {
    update(suffix: string, time = '') {
      readline.clearLine(process.stdout, -1);
      readline.moveCursor(process.stdout, 0, -1);

      latestSuffix = suffix;
      const latestContent = format([output + suffix]);

      process.stdout.write(latestContent + time + '\n');

      if (!timer) {
        timer = setInterval(() => {
          ++seconds;
          this.update(latestSuffix, `${seconds ? chalk.bold(' ' + seconds + 's') : ''}`);
        }, 1000);
      }
    },
    close() {
      clearInterval(timer);
    },
    costTime: seconds
  };
}

export const prefix = '🐳 ';
const EOL: string = '\n';
chalk.level = 2;

function format(args: Array<any>, customPrefix?: string) {
  const fullPrefix = prefix + (customPrefix === undefined ? '' : ' ' + customPrefix);
  return (
    fullPrefix +
    util
      .format('', ...args)
      .split('\n')
      .join('\n' + fullPrefix + ' ')
  );
}

export const isSilent = () => process.env.EVEM_SILENT === 'true';
export const isList = () => process.env.EVEM_LIST === 'true';

export function error(...args: Array<any>) {
  console.error(format(args, chalk.red('error')));
}

export function info(...args: Array<any>) {
  if (isSilent()) return;
  console.info(format(args, chalk.cyan('info')));
}

export function log(...args: Array<any>) {
  if (isSilent()) return;
  console.log(format(args));
}

export function success(...args: Array<any>) {
  if (isSilent()) return;
  console.log(format(args, chalk.green('success')));
}

export function warn(...args: Array<any>) {
  if (isSilent()) return;
  console.warn(format(args, chalk.yellow('warn')));
}

export function debug(...args: Array<any>) {
  if (process.env.EVEM_VERBOSE === 'true' && !isSilent()) {
    console.log(EOL + format(args, chalk.grey('debug')));
  }
}

export function list(content: string) {
  if (isList()) {
    console.log(content);
  }
}
