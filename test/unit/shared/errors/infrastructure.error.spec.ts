// @ts-nocheck
/* eslint-disable */

import { InfrastructureError } from '@shared/errors/infrastructure.error';

describe('InfrastructureError', () => {
  it('should set the message from the reason', () => {
    const error = new InfrastructureError('disk full');
    expect(error.message).toBe('Infrastructure error: disk full');
    expect(error.reason).toBe('disk full');
    expect(error.code).toBe('INFRASTRUCTURE_ERROR');
  });

  it('should store the optional cause when provided', () => {
    const cause = new Error('underlying I/O error');
    const error = new InfrastructureError('write failed', cause);
    expect(error.cause).toBe(cause);
  });

  it('should leave cause undefined when not provided', () => {
    const error = new InfrastructureError('read failed');
    expect(error.cause).toBeUndefined();
  });
});
