import { NextRequest, NextResponse } from 'next/server';
import { ApiError, toErrorResponse } from '@/lib/errors';
import { transitionReturnRequest } from '@/lib/requests-service';
import { assertValidUuid, parseTransitionInput } from '@/lib/validation';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: { id: string };
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const id = assertValidUuid(context.params.id);
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      throw new ApiError(400, 'INVALID_JSON', 'Request body must be valid JSON.');
    }

    const input = parseTransitionInput(rawBody);
    const updated = await transitionReturnRequest(id, input);
    return NextResponse.json({ data: updated });
  } catch (err) {
    return toErrorResponse(err);
  }
}
