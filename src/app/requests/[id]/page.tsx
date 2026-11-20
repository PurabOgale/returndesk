'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  canRemoveRequest,
  getAllowedTransitions,
  isRequestLocked,
  RETURN_REASONS,
  RETURN_RESOLUTIONS,
  ReturnReason,
  ReturnResolution,
  ReturnStatus,
} from '@/lib/domain';
import { ReturnRequestDetailDTO } from '@/lib/requests-service';
import { StatusBadge } from '@/components/StatusBadge';

export default function RequestDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const requestId = params.id;

  const [request, setRequest] = useState<ReturnRequestDetailDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  // Approval resolution state
  const [showApproveForm, setShowApproveForm] = useState(false);
  const [resolution, setResolution] = useState<ReturnResolution>('Refund');
  const [refundAmount, setRefundAmount] = useState('');

  // Edit details state
  const [isEditing, setIsEditing] = useState(false);
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editCustomerEmail, setEditCustomerEmail] = useState('');
  const [editCustomerPhone, setEditCustomerPhone] = useState('');
  const [editOrderNumber, setEditOrderNumber] = useState('');
  const [editItemSku, setEditItemSku] = useState('');
  const [editItemName, setEditItemName] = useState('');
  const [editQuantity, setEditQuantity] = useState('1');
  const [editReason, setEditReason] = useState<ReturnReason>('Damaged');

  // Note form state
  const [noteAuthor, setNoteAuthor] = useState('Support Agent');
  const [noteBody, setNoteBody] = useState('');
  const [noteSubmitting, setNoteSubmitting] = useState(false);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/requests/${requestId}`, {
        cache: 'no-store',
      });
      const payload = await res.json();
      if (!res.ok) {
        setLoadError(
          payload?.error?.message ?? 'Failed to load return request.'
        );
        setRequest(null);
        return;
      }
      const data: ReturnRequestDetailDTO = payload.data;
      setRequest(data);
      setEditCustomerName(data.customerName);
      setEditCustomerEmail(data.customerEmail ?? '');
      setEditCustomerPhone(data.customerPhone ?? '');
      setEditOrderNumber(data.orderNumber);
      setEditItemSku(data.itemSku);
      setEditItemName(data.itemName);
      setEditQuantity(String(data.quantity));
      setEditReason(data.reason);
    } catch {
      setLoadError('Network error while loading the return request.');
      setRequest(null);
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  async function handleTransition(
    targetStatus: ReturnStatus,
    approvalPayload?: { resolution: ReturnResolution; refundAmount: number | null }
  ) {
    setActionError(null);
    setActionBusy(true);
    try {
      const res = await fetch(`/api/requests/${requestId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetStatus,
          ...(approvalPayload
            ? {
                resolution: approvalPayload.resolution,
                refundAmount: approvalPayload.refundAmount,
              }
            : {}),
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setActionError(
          payload?.error?.message ?? 'Status transition was refused.'
        );
        return;
      }
      setShowApproveForm(false);
      setRefundAmount('');
      setRequest(payload.data);
    } catch {
      setActionError('Network error while updating status.');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleApproveSubmit(e: FormEvent) {
    e.preventDefault();
    const parsedRefund =
      resolution === 'Refund' ? Number.parseFloat(refundAmount) : null;
    await handleTransition('Approved', {
      resolution,
      refundAmount: parsedRefund,
    });
  }

  async function handleEditSubmit(e: FormEvent) {
    e.preventDefault();
    setActionError(null);
    setActionBusy(true);
    try {
      const res = await fetch(`/api/requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: editCustomerName.trim(),
          customerEmail: editCustomerEmail.trim() || null,
          customerPhone: editCustomerPhone.trim() || null,
          orderNumber: editOrderNumber.trim(),
          itemSku: editItemSku.trim(),
          itemName: editItemName.trim(),
          quantity: Number.parseInt(editQuantity, 10),
          reason: editReason,
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setActionError(payload?.error?.message ?? 'Failed to update details.');
        return;
      }
      setRequest(payload.data);
      setIsEditing(false);
    } catch {
      setActionError('Network error while saving changes.');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleRemove() {
    if (
      !window.confirm(
        'Take this request off the desk? It will disappear from the list but remain preserved in the database.'
      )
    ) {
      return;
    }
    setActionError(null);
    setActionBusy(true);
    try {
      const res = await fetch(`/api/requests/${requestId}`, {
        method: 'DELETE',
      });
      const payload = await res.json();
      if (!res.ok) {
        setActionError(payload?.error?.message ?? 'Removal was refused.');
        return;
      }
      router.push('/');
    } catch {
      setActionError('Network error while removing request.');
    } finally {
      setActionBusy(false);
    }
  }

  async function handleAddNote(e: FormEvent) {
    e.preventDefault();
    if (!noteBody.trim()) return;
    setActionError(null);
    setNoteSubmitting(true);
    try {
      const res = await fetch(`/api/requests/${requestId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author: noteAuthor.trim() || 'Support Agent',
          body: noteBody.trim(),
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setActionError(payload?.error?.message ?? 'Failed to add note.');
        return;
      }
      setNoteBody('');
      await fetchDetail();
    } catch {
      setActionError('Network error while adding note.');
    } finally {
      setNoteSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
        <p className="mt-2.5 text-sm text-slate-500">Loading request...</p>
      </div>
    );
  }

  if (loadError || !request) {
    return (
      <div className="space-y-4">
        <Link
          href="/"
          className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          &larr; Back to Desk
        </Link>
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-800"
        >
          <p className="font-semibold">Unable to open return request</p>
          <p className="mt-1">{loadError ?? 'Request not found.'}</p>
        </div>
      </div>
    );
  }

  const allowedTransitions = getAllowedTransitions(request.status);
  const locked = isRequestLocked(request.status);
  const removable = canRemoveRequest(request.status);

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/"
            className="text-xs font-medium text-slate-500 hover:text-slate-900"
          >
            &larr; Back to Return Requests
          </Link>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-xl font-bold text-slate-900 sm:text-2xl">
              {request.reference}
            </h1>
            <StatusBadge status={request.status} />
            {locked && (
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                Details Locked
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Created {new Date(request.createdAt).toLocaleString()} · Updated{' '}
            {new Date(request.updatedAt).toLocaleString()}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {!locked && (
            <button
              type="button"
              onClick={() => {
                setActionError(null);
                setIsEditing((prev) => !prev);
              }}
              className="min-h-[38px] rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {isEditing ? 'Cancel Edit' : 'Edit Details'}
            </button>
          )}
          {removable && (
            <button
              type="button"
              disabled={actionBusy}
              onClick={handleRemove}
              className="min-h-[38px] rounded-lg border border-rose-300 bg-white px-3.5 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50"
            >
              Remove from Desk
            </button>
          )}
        </div>
      </div>

      {/* Action Error Banner */}
      {actionError && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
        >
          <span className="font-semibold">Action refused: </span>
          {actionError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left 2 columns: Details & Workflow Actions */}
        <div className="space-y-6 lg:col-span-2">
          {/* Request Details Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">
              Request Details
            </h2>

            {!isEditing ? (
              <dl className="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-medium text-slate-500">Customer</dt>
                  <dd className="mt-0.5 font-medium text-slate-900">
                    {request.customerName}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500">Contact</dt>
                  <dd className="mt-0.5 text-slate-700">
                    {request.customerEmail && <div>{request.customerEmail}</div>}
                    {request.customerPhone && <div>{request.customerPhone}</div>}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500">
                    Order Number
                  </dt>
                  <dd className="mt-0.5 font-mono text-slate-900">
                    {request.orderNumber}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500">Item</dt>
                  <dd className="mt-0.5 text-slate-900">
                    {request.itemName}{' '}
                    <span className="text-xs text-slate-500">
                      ({request.itemSku}) · Qty {request.quantity}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500">Reason</dt>
                  <dd className="mt-0.5 text-slate-900">{request.reason}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-slate-500">
                    Resolution
                  </dt>
                  <dd className="mt-0.5 text-slate-900">
                    {request.resolution ? (
                      <span className="font-medium">
                        {request.resolution}
                        {request.refundAmount !== null
                          ? ` — $${request.refundAmount.toFixed(2)}`
                          : ''}
                      </span>
                    ) : (
                      <span className="text-slate-400">Not decided yet</span>
                    )}
                  </dd>
                </div>
              </dl>
            ) : (
              <form onSubmit={handleEditSubmit} className="mt-4 space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Customer Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={editCustomerName}
                      onChange={(e) => setEditCustomerName(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Order Number *
                    </label>
                    <input
                      type="text"
                      required
                      value={editOrderNumber}
                      onChange={(e) => setEditOrderNumber(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Customer Email
                    </label>
                    <input
                      type="email"
                      value={editCustomerEmail}
                      onChange={(e) => setEditCustomerEmail(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Customer Phone
                    </label>
                    <input
                      type="tel"
                      value={editCustomerPhone}
                      onChange={(e) => setEditCustomerPhone(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Item SKU *
                    </label>
                    <input
                      type="text"
                      required
                      value={editItemSku}
                      onChange={(e) => setEditItemSku(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Item Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={editItemName}
                      onChange={(e) => setEditItemName(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Quantity *
                    </label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      required
                      value={editQuantity}
                      onChange={(e) => setEditQuantity(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">
                      Reason *
                    </label>
                    <select
                      value={editReason}
                      onChange={(e) =>
                        setEditReason(e.target.value as ReturnReason)
                      }
                      className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      {RETURN_REASONS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionBusy}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    {actionBusy ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Workflow / Legal Status Transitions Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">
              Workflow Actions
            </h2>

            {allowedTransitions.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">
                This request is in a final status ({request.status}). No further
                status transitions are permitted.
              </p>
            ) : (
              <div className="mt-3 space-y-4">
                <div className="flex flex-wrap gap-2.5">
                  {allowedTransitions.includes('In Review') && (
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={() => handleTransition('In Review')}
                      className="min-h-[40px] rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      Move to In Review
                    </button>
                  )}

                  {allowedTransitions.includes('Approved') && (
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={() => setShowApproveForm((prev) => !prev)}
                      className="min-h-[40px] rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {showApproveForm ? 'Hide Approval Form' : 'Approve Request'}
                    </button>
                  )}

                  {allowedTransitions.includes('Rejected') && (
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={() => handleTransition('Rejected')}
                      className="min-h-[40px] rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                    >
                      Reject Request
                    </button>
                  )}

                  {allowedTransitions.includes('Completed') && (
                    <button
                      type="button"
                      disabled={actionBusy}
                      onClick={() => handleTransition('Completed')}
                      className="min-h-[40px] rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      Mark Completed
                    </button>
                  )}
                </div>

                {showApproveForm && allowedTransitions.includes('Approved') && (
                  <form
                    onSubmit={handleApproveSubmit}
                    className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 space-y-3"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-900">
                      Approval Resolution Required
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-medium text-slate-700">
                          Resolution *
                        </label>
                        <select
                          value={resolution}
                          onChange={(e) => {
                            const val = e.target.value as ReturnResolution;
                            setResolution(val);
                            if (val !== 'Refund') setRefundAmount('');
                          }}
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                        >
                          {RETURN_RESOLUTIONS.map((resOpt) => (
                            <option key={resOpt} value={resOpt}>
                              {resOpt}
                            </option>
                          ))}
                        </select>
                      </div>

                      {resolution === 'Refund' && (
                        <div>
                          <label className="block text-xs font-medium text-slate-700">
                            Refund Amount ($) *
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            required
                            value={refundAmount}
                            onChange={(e) => setRefundAmount(e.target.value)}
                            placeholder="e.g. 49.99"
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="submit"
                        disabled={actionBusy}
                        className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
                      >
                        {actionBusy ? 'Approving...' : 'Confirm Approval'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Append-Only Notes */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            Activity &amp; Notes ({request.notes.length})
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Notes are chronological and permanent once added.
          </p>

          <div className="mt-4 space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {request.notes.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 p-4 text-center text-xs text-slate-500">
                No notes yet. Add the first note below.
              </p>
            ) : (
              request.notes.map((note) => (
                <div
                  key={note.id}
                  className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm"
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-slate-800">
                      {note.author}
                    </span>
                    <span className="text-slate-400">
                      {new Date(note.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-slate-700">
                    {note.body}
                  </p>
                </div>
              ))
            )}
          </div>

          <form
            onSubmit={handleAddNote}
            className="mt-4 space-y-3 border-t border-slate-200 pt-4"
          >
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Agent Name
              </label>
              <input
                type="text"
                value={noteAuthor}
                onChange={(e) => setNoteAuthor(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700">
                Add Note *
              </label>
              <textarea
                rows={3}
                required
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                placeholder="Write an internal note..."
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={noteSubmitting || !noteBody.trim()}
              className="w-full min-h-[38px] rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {noteSubmitting ? 'Adding...' : 'Add Note'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
