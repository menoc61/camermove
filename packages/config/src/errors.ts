export class AppError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'AppError'
    this.status = status
    this.code = code
  }
}
export class BadRequestError extends AppError {
  constructor(msg = 'Requête invalide', code = 'BAD_REQUEST') {
    super(400, code, msg)
  }
}
export class UnauthorizedError extends AppError {
  constructor(msg = 'Non autorisé', code = 'UNAUTHORIZED') {
    super(401, code, msg)
  }
}
export class ForbiddenError extends AppError {
  constructor(msg = 'Accès refusé', code = 'FORBIDDEN') {
    super(403, code, msg)
  }
}
export class NotFoundError extends AppError {
  constructor(msg = 'Introuvable', code = 'NOT_FOUND') {
    super(404, code, msg)
  }
}
export class ConflictError extends AppError {
  constructor(msg = 'Conflit', code = 'CONFLICT') {
    super(409, code, msg)
  }
}
