import type { NextFunction, Request, Response } from 'express';
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function requireValue(
  condition: unknown,
  status: number,
  message: string,
): asserts condition {
  if (!condition) throw new HttpError(status, message);
}
export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof HttpError) return res.status(error.status).json({ error: error.message });
  if (error instanceof Error && error.name === 'ZodError')
    return res
      .status(400)
      .json({ error: 'Invalid input. Check the required fields, references, and session times.' });
  console.error(error);
  return res
    .status(500)
    .json({ error: 'The server could not finish this request. Please try again.' });
}
