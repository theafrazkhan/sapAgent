export class AppError extends Error { constructor(message: string, public status = 400) { super(message); } }
export function publicError(error: unknown): {error: string; status: number} {
  if (error instanceof AppError) return {error:error.message,status:error.status};
  const failure=error as {code?:string;errors?:{code?:string}[]};
  const codes=[failure?.code,...(failure?.errors??[]).map(e=>e.code)];
  if(codes.some(code=>['ECONNREFUSED','ETIMEDOUT','ENETUNREACH','EAI_AGAIN','ECONNRESET'].includes(code||''))){
    console.error('Database connection unavailable',{codes});
    return {error:'The database connection is unavailable. Restore the connection and retry; your uploaded data is preserved.',status:503};
  }
  console.error('Request failed', {name: error instanceof Error ? error.name : 'UnknownError',code:failure?.code});
  return {error:'The request could not be completed. Please retry or check server configuration.',status:500};
}
