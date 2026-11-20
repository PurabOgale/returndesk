import { NextResponse } from 'next/server';

export type ErrorCode =
  | 'INVALID_JSON'
  | 'INVALID_ID'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'INVALID_STATUS_TRANSITION'
  | 'MISSING_RESOLUTION'
  | 'INVALID_REFUND_AMOUNT'
  | 'FORBIDDEN_RESOLUTION'
  | 'DUPLICATE_LIVE_REQUEST'
  | 'REQUEST_LOCKED'
  | 'REMOVAL_NOT_ALLOWED'
  | 'DATABASE_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: Record<string, unknown>;

  constructor(
    statusCode: number,
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

interface PgErrorLike {
  code?: string;
  constraint?: string;
  detail?: string;
}

function isPgError(err: unknown): err is PgErrorLike {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof (err as PgErrorLike).code === 'string'
  );
}

export function toErrorResponse(err: unknown): NextResponse {
  if (err instanceof ApiError) {
    return NextResponse.json(
      {
        error: {
          code: err.code,
          message: err.message,
          ...(err.details ? { details: err.details } : {}),
        },
      },
      { status: err.statusCode }
    );
  }

  if (isPgError(err)) {
    // 23505 = unique_violation
    if (err.code === '23505') {
      if (err.constraint === 'idx_one_live_request_per_order_item') {
        return NextResponse.json(
          {
            error: {
              code: 'DUPLICATE_LIVE_REQUEST',
              message:
                'A live return request already exists for this item on this order. Close out or reject the existing request before creating a new one.',
            },
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        {
          error: {
            code: 'DUPLICATE_LIVE_REQUEST',
            message: 'A conflicting record already exists.',
          },
        },
        { status: 409 }
      );
    }

    // 22P02 = invalid_text_representation (e.g., malformed UUID)
    if (err.code === '22P02') {
      return NextResponse.json(
        {
          error: {
            code: 'INVALID_ID',
            message: 'The provided identifier is not a valid UUID.',
          },
        },
        { status: 400 }
      );
    }

    // 23514 = check_violation
    if (err.code === '23514') {
      return NextResponse.json(
        {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request violates a database integrity constraint.',
            details: { constraint: err.constraint },
          },
        },
        { status: 422 }
      );
    }

    // Connection errors
    if (err.code === 'ECONNREFUSED' || err.code === '57P01') {
      return NextResponse.json(
        {
          error: {
            code: 'DATABASE_UNAVAILABLE',
            message: 'Database connection is currently unavailable.',
          },
        },
        { status: 503 }
      );
    }
  }

  console.error('Unhandled API error:', err);
  return NextResponse.json(
    {
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected server error occurred.',
      },
    },
    { status: 500 }
  );
}
