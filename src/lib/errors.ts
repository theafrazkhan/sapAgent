export class AppError extends Error { constructor(message: string, public status = 400) { super(message); } }
export function publicError(error: unknown): {error: string; status: number} {
  if (error instanceof AppError) return {error:error.message,status:error.status};
  console.error('Request failed', {name: error instanceof Error ? error.name : 'UnknownError'});
  return {error:'The request could not be completed. Please retry or check server configuration.',status:500};
}
