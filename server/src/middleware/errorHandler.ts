import { Request, Response, NextFunction } from 'express';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[CocoCraft Server Error]:', err);

  const status = 'status' in err && typeof (err as { status?: unknown }).status === 'number'
    ? (err as { status: number }).status
    : 500;

  res.status(status).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
}
