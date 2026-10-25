export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function notFound(message = "Resource not found"): AppError {
  return new AppError(404, "NOT_FOUND", message);
}

export function badRequest(message: string, details?: unknown): AppError {
  return new AppError(400, "BAD_REQUEST", message, details);
}

export function unauthorized(message = "Não autenticado."): AppError {
  return new AppError(401, "UNAUTHORIZED", message);
}

export function forbidden(message = "Acesso negado."): AppError {
  return new AppError(403, "FORBIDDEN", message);
}

/** Generic login failure — never reveal which check failed. */
export function invalidCredentials(): AppError {
  return new AppError(401, "INVALID_CREDENTIALS", "Credenciais inválidas.");
}

export function conflict(message: string, details?: unknown): AppError {
  return new AppError(409, "CONFLICT", message, details);
}

/** Authenticated ops require an explicit current establishment on the session. */
export function establishmentContextRequired(
  message = "Selecione um estabelecimento para continuar.",
): AppError {
  return new AppError(409, "ESTABLISHMENT_CONTEXT_REQUIRED", message);
}
