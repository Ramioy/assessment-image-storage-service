export class InfrastructureError {
  readonly code = 'INFRASTRUCTURE_ERROR' as const;
  readonly message: string;

  constructor(
    readonly reason: string,
    readonly cause?: unknown,
  ) {
    this.message = `Infrastructure error: ${reason}`;
  }
}
