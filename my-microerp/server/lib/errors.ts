import type { Response } from 'express';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function sendError(res: Response, err: unknown): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  console.error('[unhandled]', err);
  res.status(500).json({ error: 'Internal server error' });
}
