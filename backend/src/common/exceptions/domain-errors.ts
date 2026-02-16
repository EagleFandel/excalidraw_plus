export class DomainError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
    public readonly extras?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export class InvalidInputError extends DomainError {
  constructor(message = "Invalid input") {
    super("INVALID_INPUT", 400, message);
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = "Authentication required") {
    super("UNAUTHORIZED", 401, message);
  }
}

export class InvalidCredentialsError extends DomainError {
  constructor() {
    super("INVALID_CREDENTIALS", 401, "Email or password is incorrect");
  }
}

export class EmailAlreadyExistsError extends DomainError {
  constructor() {
    super("EMAIL_ALREADY_EXISTS", 409, "Email is already registered");
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = "No access") {
    super("FORBIDDEN", 403, message);
  }
}

export class FileNotFoundError extends DomainError {
  constructor() {
    super("FILE_NOT_FOUND", 404, "File not found");
  }
}

export class TeamNotFoundError extends DomainError {
  constructor(message = "Team not found") {
    super("TEAM_NOT_FOUND", 404, message);
  }
}

export class VersionConflictError extends DomainError {
  constructor(currentVersion: number) {
    super("VERSION_CONFLICT", 409, "Version conflict", { currentVersion });
  }
}

export class PayloadTooLargeError extends DomainError {
  constructor(message = "Payload exceeds maximum size") {
    super("PAYLOAD_TOO_LARGE", 413, message);
  }
}

export class CollabAssetNotFoundError extends DomainError {
  constructor() {
    super("COLLAB_ASSET_NOT_FOUND", 404, "Collaboration asset not found");
  }
}

export class AiDisabledError extends DomainError {
  constructor() {
    super("AI_DISABLED", 503, "AI service is disabled");
  }
}

export class TooManyRequestsError extends DomainError {
  constructor(message = "Too many requests") {
    super("RATE_LIMITED", 429, message);
  }
}
