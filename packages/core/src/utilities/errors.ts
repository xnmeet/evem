import ExtendableError from 'extendable-error';

export class ExitError extends ExtendableError {
  code: number;
  constructor(code: number) {
    super(`The process exited with code: ${code}`);
    this.code = code;
  }
}

export class InternalError extends ExtendableError {}
