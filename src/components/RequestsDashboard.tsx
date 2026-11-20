'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  RETURN_REASONS,
  RETURN_STATUSES,
  ReturnReason,
  ReturnStatus,
} from '@/lib/domain';
import { ReturnRequestDTO } from '@/lib/requests-service';
import { StatusBadge } from './StatusBadge';
import { CreateRequestModal } from './CreateRequestModal';

interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export function RequestsDashboard() {
  const [items, setItems] = useState<ReturnRequestDTO[]>([]);
  const [pagination, setPagination] = useState<PaginationMeta>({
    page: 1,
    pageSize: 10,
    totalItems: 0,
    totalPages: 1,
  });

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [reasonFilter, setReasonFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState<number>(1);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false);

  // Debounce search so it never fires a request on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const qs = new URLSearchParams();
      if (debouncedSearch) qs.set('search', debouncedSearch);
      if (statusFilter) qs.set('status', statusFilter);
      if (reasonFilter) qs.set('reason', reasonFilter);
      qs.set('sortBy', sortBy);
      qs.set('sortOrder', sortOrder);
      qs.set('page', String(page));
      qs.set('pageSize', '10');

      const res = await fetch(`/api/requests?${qs.toString()}`, {
        cache: 'no-store',
      });
      const payload = await res.json();

      if (!res.ok) {
        setError(payload?.error?.message ?? 'Failed to load return requests.');
        setItems([]);
        return;
      }

      setItems(payload.data ?? []);
      setPagination(
        payload.pagination ?? {
          page: 1,
          pageSize: 10,
          totalItems: 0,
          totalPages: 1,
        }
      );
    } catch {
      setError('Unable to reach the server. Please check your connection.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, statusFilter, reasonFilter, sortBy, sortOrder, page]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    setDebouncedSearch(searchInput.trim());
    setPage(1);
  }

  function handleClearFilters() {
    setSearchInput('');
    setDebouncedSearch('');
    setStatusFilter('');
    setReasonFilter('');
    setSortBy('created_at');
    setSortOrder('desc');
    setPage(1);
  }

  const hasActiveFilters = Boolean(
    debouncedSearch || statusFilter || reasonFilter
  );

  return (
    <div className="space-y-5">
      {/* Top Action Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">
            Return Requests
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Search, triage, and resolve customer return requests.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex min-h-[40px] items-center justify-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800"
        >
          + Raise Request
        </button>
      </div>

      {/* Filters & Search Controls */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <form
          onSubmit={handleSearchSubmit}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12"
        >
          <div className="lg:col-span-4">
            <label
              htmlFor="search-input"
              className="block text-xs font-medium text-slate-600"
            >
              Search (Customer, Order, or Reference)
            </label>
            <input
              id="search-input"
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="e.g. RET-2026-0001, ORD-2026, Aarav..."
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
            />
          </div>

          <div className="lg:col-span-2">
            <label
              htmlFor="status-filter"
              className="block text-xs font-medium text-slate-600"
            >
              Status
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as ReturnStatus | '');
                setPage(1);
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
            >
              <option value="">All Statuses</option>
              {RETURN_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label
              htmlFor="reason-filter"
              className="block text-xs font-medium text-slate-600"
            >
              Reason
            </label>
            <select
              id="reason-filter"
              value={reasonFilter}
              onChange={(e) => {
                setReasonFilter(e.target.value as ReturnReason | '');
                setPage(1);
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
            >
              <option value="">All Reasons</option>
              {RETURN_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label
              htmlFor="sort-by"
              className="block text-xs font-medium text-slate-600"
            >
              Sort By
            </label>
            <select
              id="sort-by"
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
            >
              <option value="created_at">Created Date</option>
              <option value="updated_at">Last Updated</option>
              <option value="status">Status</option>
              <option value="customer_name">Customer</option>
              <option value="order_number">Order #</option>
              <option value="reference">Reference</option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <label
              htmlFor="sort-order"
              className="block text-xs font-medium text-slate-600"
            >
              Direction
            </label>
            <select
              id="sort-order"
              value={sortOrder}
              onChange={(e) => {
                setSortOrder(e.target.value as 'asc' | 'desc');
                setPage(1);
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
            >
              <option value="desc">Newest / Z–A</option>
              <option value="asc">Oldest / A–Z</option>
            </select>
          </div>
        </form>

        {hasActiveFilters && (
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs text-slate-500">
            <span>
              Showing {pagination.totalItems} matching request
              {pagination.totalItems === 1 ? '' : 's'}
            </span>
            <button
              type="button"
              onClick={handleClearFilters}
              className="font-medium text-slate-700 underline hover:text-slate-900"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div
          role="alert"
          className="flex flex-col items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 sm:flex-row sm:items-center"
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={fetchRequests}
            className="rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-medium text-rose-800 hover:bg-rose-100"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900" />
          <p className="mt-2.5 text-sm text-slate-500">
            Loading return requests...
          </p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && items.length === 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <p className="text-base font-medium text-slate-900">
            {hasActiveFilters
              ? 'No return requests match your filters'
              : 'No return requests on the desk'}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {hasActiveFilters
              ? 'Try broadening your search query or clearing the active status/reason filters.'
              : 'Raise a new return request to get started.'}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="mt-4 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Clear Filters
            </button>
          )}
        </div>
      )}

      {/* Desktop Table View (>= md) */}
      {!loading && !error && items.length > 0 && (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Reference</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Order &amp; Item</th>
                    <th className="px-4 py-3">Reason</th>
                    <th className="px-4 py-3">Resolution</th>
                    <th className="px-4 py-3 text-right">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {items.map((req) => (
                    <tr
                      key={req.id}
                      className="transition-colors hover:bg-slate-50/80"
                    >
                      <td className="whitespace-nowrap px-4 py-3.5 font-mono text-xs font-semibold text-slate-900">
                        <Link
                          href={`/requests/${req.id}`}
                          className="underline decoration-slate-300 underline-offset-2 hover:decoration-slate-900"
                        >
                          {req.reference}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <StatusBadge status={req.status} />
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-slate-900">
                          {req.customerName}
                        </div>
                        <div className="text-xs text-slate-500">
                          {req.customerEmail ?? req.customerPhone}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-slate-900">
                          {req.itemName}{' '}
                          <span className="text-xs font-normal text-slate-500">
                            ×{req.quantity}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500">
                          {req.orderNumber} · {req.itemSku}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-slate-700">
                        {req.reason}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-slate-700">
                        {req.resolution ? (
                          <span>
                            {req.resolution}
                            {req.refundAmount !== null
                              ? ` ($${req.refundAmount.toFixed(2)})`
                              : ''}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-right text-xs text-slate-500">
                        {req.noteCount ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card View (< md, usable down to 375px) */}
          <div className="space-y-3 md:hidden">
            {items.map((req) => (
              <Link
                key={req.id}
                href={`/requests/${req.id}`}
                className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold text-slate-900">
                    {req.reference}
                  </span>
                  <StatusBadge status={req.status} />
                </div>
                <div className="mt-2">
                  <p className="font-medium text-slate-900">{req.customerName}</p>
                  <p className="text-xs text-slate-500">
                    {req.orderNumber} · {req.itemName} (×{req.quantity})
                  </p>
                </div>
                <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-xs text-slate-600">
                  <span>{req.reason}</span>
                  <span>
                    {req.resolution
                      ? req.refundAmount !== null
                        ? `${req.resolution} ($${req.refundAmount.toFixed(2)})`
                        : req.resolution
                      : `${req.noteCount ?? 0} note${req.noteCount === 1 ? '' : 's'}`}
                  </span>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination Controls */}
          <div className="flex flex-col items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm sm:flex-row">
            <p className="text-xs text-slate-600">
              Page <span className="font-semibold">{pagination.page}</span> of{' '}
              <span className="font-semibold">{pagination.totalPages}</span> (
              {pagination.totalItems} total request
              {pagination.totalItems === 1 ? '' : 's'})
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="min-h-[36px] rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() =>
                  setPage((p) => Math.min(pagination.totalPages, p + 1))
                }
                className="min-h-[36px] rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      <CreateRequestModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={fetchRequests}
      />
    </div>
  );
}
