export type ErrorCode =
  | "INVALID_INPUT"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "INVALID_CREDENTIALS"
  | "LICENSE_NOT_FOUND"
  | "LICENSE_REVOKED"
  | "LICENSE_SUSPENDED"
  | "LICENSE_EXPIRED"
  | "LICENSE_NOT_ACTIVE"
  | "DEVICE_NOT_FOUND"
  | "DEVICE_NOT_ACTIVATED"
  | "DEVICE_LIMIT_REACHED"
  | "DEACTIVATED_DEVICE"
  | "INVALID_NONCE"
  | "INTERNAL_ERROR";

export class ApiError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
    /**
     * When true, the error response for a client (Madar) endpoint is also
     * signed with the Ed25519 private key so the client can verify it.
     */
    public readonly signed = false,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const Errors = {
  invalidInput: (message = "Invalid request input", details?: unknown) =>
    new ApiError("INVALID_INPUT", 400, message, details),
  unauthorized: (message = "Authentication required") =>
    new ApiError("UNAUTHORIZED", 401, message),
  forbidden: (message = "You are not allowed to perform this action") =>
    new ApiError("FORBIDDEN", 403, message),
  notFound: (message = "Resource not found") => new ApiError("NOT_FOUND", 404, message),
  rateLimited: (retryAfterSeconds: number) =>
    new ApiError("RATE_LIMITED", 429, `Too many requests. Try again in ${retryAfterSeconds}s`, {
      retryAfterSeconds,
    }),
  invalidCredentials: () =>
    new ApiError("INVALID_CREDENTIALS", 401, "Invalid email or password"),
  licenseNotFound: () => new ApiError("LICENSE_NOT_FOUND", 404, "License not found"),
  licenseRevoked: () => new ApiError("LICENSE_REVOKED", 403, "License has been revoked", undefined, true),
  licenseSuspended: () => new ApiError("LICENSE_SUSPENDED", 403, "License is suspended", undefined, true),
  licenseExpired: () => new ApiError("LICENSE_EXPIRED", 403, "License has expired", undefined, true),
  licenseNotActive: (status: string) =>
    new ApiError("LICENSE_NOT_ACTIVE", 403, `License is not active (status: ${status})`, undefined, true),
  deviceNotFound: () => new ApiError("DEVICE_NOT_FOUND", 404, "Device not found"),
  deviceNotActivated: () =>
    new ApiError("DEVICE_NOT_ACTIVATED", 403, "Device is not activated for this license"),
  deviceLimitReached: (max: number) =>
    new ApiError("DEVICE_LIMIT_REACHED", 403, `Device limit reached (${max} devices)`),
  deactivatedDevice: () =>
    new ApiError("DEACTIVATED_DEVICE", 403, "Device has been deactivated for this license"),
  invalidNonce: () => new ApiError("INVALID_NONCE", 400, "Missing or invalid nonce"),
};
