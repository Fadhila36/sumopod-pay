/**
 * Custom exception classes for the SumoPod SDK
 */

/** Base error class for all SumoPod SDK errors */
export class SumoPodError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SumoPodError';
    Object.setPrototypeOf(this, new.target.prototype);
    if (process.env.NODE_ENV === 'production') {
      this.stack = undefined;
    }
  }
}

/** Thrown when the SumoPod API returns an error response (4xx, 5xx after retries) */
export class SumoPodApiError extends SumoPodError {
  public readonly statusCode: number;
  public readonly responseBody: unknown;

  constructor(statusCode: number, message: string, responseBody?: unknown) {
    super(`SumoPod API Error (${statusCode}): ${message}`);
    this.name = 'SumoPodApiError';
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }
}

/** Thrown when input validation fails before sending a request */
export class SumoPodValidationError extends SumoPodError {
  public readonly field: string;

  constructor(field: string, message: string) {
    super(`Validation Error [${field}]: ${message}`);
    this.name = 'SumoPodValidationError';
    this.field = field;
  }
}

/** Thrown when webhook verification fails */
export class SumoPodWebhookError extends SumoPodError {
  constructor(message: string) {
    super(`Webhook Verification Error: ${message}`);
    this.name = 'SumoPodWebhookError';
  }
}
