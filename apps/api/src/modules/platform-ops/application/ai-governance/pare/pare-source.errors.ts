export class PareSourceNotFoundError extends Error {
  readonly code = 'PARE_SOURCE_NOT_FOUND';
  constructor(message: string) {
    super(message);
    this.name = 'PareSourceNotFoundError';
  }
}
