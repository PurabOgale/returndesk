import { NextRequest, NextResponse } from 'next/server';
import { ApiError, toErrorResponse } from '@/lib/errors';
import { addReturnNote } from '@/lib/requests-service';
import { assertValidUuid, parseCreateNoteInput } from '@/lib/validation';

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

    const input = parseCreateNoteInput(rawBody);
    const note = await addReturnNote(id, input);
    return NextResponse.json({ data: note }, { status: 201 });
  } catch (err) {
    return toErrorResponse(err);
  }
}
