import test from 'node:test';
import assert from 'node:assert/strict';

// Pure JS mirror of domain rules for native `node --test` execution without external test runners.
// Matches src/lib/domain.ts 1:1.
const ALLOWED_TRANSITIONS = {
  Open: ['In Review'],
  'In Review': ['Approved', 'Rejected'],
  Approved: ['Completed'],
  Rejected: [],
  Completed: [],
};

const LOCKED_STATUSES = ['Approved', 'Rejected', 'Completed'];
const REMOVABLE_STATUSES = ['Open', 'Rejected'];

function validateTransitionRule({ currentStatus, targetStatus, resolution = null, refundAmount = null }) {
  const allowed = ALLOWED_TRANSITIONS[currentStatus] ?? [];
  if (!allowed.includes(targetStatus)) {
    const err = new Error(`Illegal transition from ${currentStatus} to ${targetStatus}`);
    err.statusCode = 409;
    err.code = 'INVALID_STATUS_TRANSITION';
    throw err;
  }

  if (targetStatus === 'Approved') {
    if (!resolution || !['Refund', 'Replacement', 'Store Credit'].includes(resolution)) {
      const err = new Error('Resolution required for Approved');
      err.statusCode = 422;
      err.code = 'MISSING_RESOLUTION';
      throw err;
    }
    if (resolution === 'Refund') {
      if (typeof refundAmount !== 'number' || !Number.isFinite(refundAmount) || refundAmount <= 0) {
        const err = new Error('Positive refundAmount required for Refund');
        err.statusCode = 422;
        err.code = 'INVALID_REFUND_AMOUNT';
        throw err;
      }
      return { nextResolution: 'Refund', nextRefundAmount: Math.round(refundAmount * 100) / 100 };
    }
    if (refundAmount !== null && refundAmount !== undefined) {
      const err = new Error('No refundAmount allowed for non-Refund resolution');
      err.statusCode = 422;
      err.code = 'INVALID_REFUND_AMOUNT';
      throw err;
    }
    return { nextResolution: resolution, nextRefundAmount: null };
  }

  if (resolution !== null && resolution !== undefined) {
    const err = new Error('Resolution only allowed when approving');
    err.statusCode = 422;
    err.code = 'FORBIDDEN_RESOLUTION';
    throw err;
  }
  if (refundAmount !== null && refundAmount !== undefined) {
    const err = new Error('Refund amount only allowed when approving with Refund');
    err.statusCode = 422;
    err.code = 'INVALID_REFUND_AMOUNT';
    throw err;
  }

  return { nextResolution: null, nextRefundAmount: null };
}

test('Rule 1: Legal status transitions succeed', () => {
  assert.doesNotThrow(() =>
    validateTransitionRule({ currentStatus: 'Open', targetStatus: 'In Review' })
  );
  assert.doesNotThrow(() =>
    validateTransitionRule({
      currentStatus: 'In Review',
      targetStatus: 'Approved',
      resolution: 'Replacement',
    })
  );
  assert.doesNotThrow(() =>
    validateTransitionRule({ currentStatus: 'In Review', targetStatus: 'Rejected' })
  );
  assert.doesNotThrow(() =>
    validateTransitionRule({ currentStatus: 'Approved', targetStatus: 'Completed' })
  );
});

test('Rule 1: Illegal status transitions are refused with 409', () => {
  const illegalPairs = [
    ['Open', 'Approved'],
    ['Open', 'Rejected'],
    ['Open', 'Completed'],
    ['In Review', 'Open'],
    ['In Review', 'Completed'],
    ['Approved', 'Rejected'],
    ['Approved', 'In Review'],
    ['Rejected', 'Open'],
    ['Rejected', 'Approved'],
    ['Completed', 'Open'],
    ['Completed', 'Rejected'],
  ];

  for (const [from, to] of illegalPairs) {
    assert.throws(
      () => validateTransitionRule({ currentStatus: from, targetStatus: to }),
      (err) => err.statusCode === 409 && err.code === 'INVALID_STATUS_TRANSITION'
    );
  }
});

test('Rule 2: Approval requires valid resolution and refund amount rules', () => {
  assert.throws(
    () => validateTransitionRule({ currentStatus: 'In Review', targetStatus: 'Approved' }),
    (err) => err.statusCode === 422 && err.code === 'MISSING_RESOLUTION'
  );

  assert.throws(
    () =>
      validateTransitionRule({
        currentStatus: 'In Review',
        targetStatus: 'Approved',
        resolution: 'Refund',
        refundAmount: 0,
      }),
    (err) => err.statusCode === 422 && err.code === 'INVALID_REFUND_AMOUNT'
  );

  assert.throws(
    () =>
      validateTransitionRule({
        currentStatus: 'In Review',
        targetStatus: 'Approved',
        resolution: 'Replacement',
        refundAmount: 25,
      }),
    (err) => err.statusCode === 422 && err.code === 'INVALID_REFUND_AMOUNT'
  );

  const approvedRefund = validateTransitionRule({
    currentStatus: 'In Review',
    targetStatus: 'Approved',
    resolution: 'Refund',
    refundAmount: 49.995,
  });
  assert.deepEqual(approvedRefund, { nextResolution: 'Refund', nextRefundAmount: 50 });
});

test('Rule 4: Locked statuses prevent edits', () => {
  assert.equal(LOCKED_STATUSES.includes('Open'), false);
  assert.equal(LOCKED_STATUSES.includes('In Review'), false);
  assert.equal(LOCKED_STATUSES.includes('Approved'), true);
  assert.equal(LOCKED_STATUSES.includes('Rejected'), true);
  assert.equal(LOCKED_STATUSES.includes('Completed'), true);
});

test('Rule 5: Removal only allowed for Open or Rejected', () => {
  assert.equal(REMOVABLE_STATUSES.includes('Open'), true);
  assert.equal(REMOVABLE_STATUSES.includes('Rejected'), true);
  assert.equal(REMOVABLE_STATUSES.includes('In Review'), false);
  assert.equal(REMOVABLE_STATUSES.includes('Approved'), false);
  assert.equal(REMOVABLE_STATUSES.includes('Completed'), false);
});
