import { ApiError } from './errors';

export const RETURN_REASONS = [
  'Damaged',
  'Wrong Item',
  'Size Issue',
  'Not As Described',
  'Changed Mind',
] as const;
export type ReturnReason = (typeof RETURN_REASONS)[number];

export const RETURN_STATUSES = [
  'Open',
  'In Review',
  'Approved',
  'Rejected',
  'Completed',
] as const;
export type ReturnStatus = (typeof RETURN_STATUSES)[number];

export const RETURN_RESOLUTIONS = [
  'Refund',
  'Replacement',
  'Store Credit',
] as const;
export type ReturnResolution = (typeof RETURN_RESOLUTIONS)[number];

export const LIVE_STATUSES: readonly ReturnStatus[] = [
  'Open',
  'In Review',
  'Approved',
];

export const FINAL_STATUSES: readonly ReturnStatus[] = [
  'Rejected',
  'Completed',
];

export const LOCKED_STATUSES: readonly ReturnStatus[] = [
  'Approved',
  'Rejected',
  'Completed',
];

export const REMOVABLE_STATUSES: readonly ReturnStatus[] = [
  'Open',
  'Rejected',
];

/**
 * Rule 1: Fixed lifecycle transitions.
 * Open -> In Review -> Approved -> Completed
 *                   -> Rejected
 */
export const ALLOWED_TRANSITIONS: Record<ReturnStatus, readonly ReturnStatus[]> = {
  Open: ['In Review'],
  'In Review': ['Approved', 'Rejected'],
  Approved: ['Completed'],
  Rejected: [],
  Completed: [],
};

export function getAllowedTransitions(status: ReturnStatus): readonly ReturnStatus[] {
  return ALLOWED_TRANSITIONS[status] ?? [];
}

export function isRequestLocked(status: ReturnStatus): boolean {
  return LOCKED_STATUSES.includes(status);
}

export function canRemoveRequest(status: ReturnStatus): boolean {
  return REMOVABLE_STATUSES.includes(status);
}

export function isLiveStatus(status: ReturnStatus): boolean {
  return LIVE_STATUSES.includes(status);
}

/**
 * Rule 1 & Rule 2 enforcement for status transitions.
 */
export function validateTransitionRule(params: {
  currentStatus: ReturnStatus;
  targetStatus: ReturnStatus;
  resolution?: ReturnResolution | null;
  refundAmount?: number | null;
}): {
  nextResolution: ReturnResolution | null;
  nextRefundAmount: number | null;
} {
  const { currentStatus, targetStatus, resolution, refundAmount } = params;
  const allowed = getAllowedTransitions(currentStatus);

  if (!allowed.includes(targetStatus)) {
    const allowedText =
      allowed.length > 0 ? allowed.join(', ') : 'none (final status)';
    throw new ApiError(
      409,
      'INVALID_STATUS_TRANSITION',
      `Cannot transition request from '${currentStatus}' to '${targetStatus}'. Legal next statuses: ${allowedText}.`,
      {
        currentStatus,
        targetStatus,
        allowedTransitions: allowed,
      }
    );
  }

  // Rule 2: Approval needs a resolution (and only Approval sets resolution)
  if (targetStatus === 'Approved') {
    if (!resolution) {
      throw new ApiError(
        422,
        'MISSING_RESOLUTION',
        'Approving a request requires a resolution of Refund, Replacement, or Store Credit.',
        { allowedResolutions: RETURN_RESOLUTIONS }
      );
    }

    if (resolution === 'Refund') {
      if (
        refundAmount === undefined ||
        refundAmount === null ||
        typeof refundAmount !== 'number' ||
        !Number.isFinite(refundAmount) ||
        refundAmount <= 0
      ) {
        throw new ApiError(
          422,
          'INVALID_REFUND_AMOUNT',
          'A refund amount greater than 0 is required when resolution is Refund.'
        );
      }
      return {
        nextResolution: 'Refund',
        nextRefundAmount: Math.round(refundAmount * 100) / 100,
      };
    }

    // Replacement or Store Credit: no refund amount may be recorded
    if (refundAmount !== undefined && refundAmount !== null) {
      throw new ApiError(
        422,
        'INVALID_REFUND_AMOUNT',
        `No refund amount may be recorded when resolution is '${resolution}'.`
      );
    }

    return {
      nextResolution: resolution,
      nextRefundAmount: null,
    };
  }

  // Non-Approval transitions must not supply resolution or refundAmount
  if (resolution !== undefined && resolution !== null) {
    throw new ApiError(
      422,
      'FORBIDDEN_RESOLUTION',
      `Resolution can only be set when transitioning to 'Approved', not '${targetStatus}'.`
    );
  }

  if (refundAmount !== undefined && refundAmount !== null) {
    throw new ApiError(
      422,
      'INVALID_REFUND_AMOUNT',
      `Refund amount cannot be set when transitioning to '${targetStatus}'.`
    );
  }

  return {
    nextResolution: null,
    nextRefundAmount: null,
  };
}

/**
 * Rule 4 enforcement: Locked once decided (Approved, Rejected, Completed).
 */
export function assertRequestEditable(status: ReturnStatus): void {
  if (isRequestLocked(status)) {
    throw new ApiError(
      409,
      'REQUEST_LOCKED',
      `Request details cannot be edited once status is '${status}'. Notes may still be added.`,
      { currentStatus: status, lockedStatuses: LOCKED_STATUSES }
    );
  }
}

/**
 * Rule 5 enforcement: Removal only allowed for Open or Rejected.
 */
export function assertRequestRemovable(status: ReturnStatus): void {
  if (!canRemoveRequest(status)) {
    throw new ApiError(
      409,
      'REMOVAL_NOT_ALLOWED',
      `Cannot remove a request in '${status}' status. Only Open or Rejected requests may be removed from the desk.`,
      { currentStatus: status, removableStatuses: REMOVABLE_STATUSES }
    );
  }
}

export function formatReturnReference(sequenceValue: number | string, year?: number): string {
  const yr = year ?? new Date().getUTCFullYear();
  const padded = String(sequenceValue).padStart(4, '0');
  return `RET-${yr}-${padded}`;
}
