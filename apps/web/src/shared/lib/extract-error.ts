// Pulls a human-readable message out of an axios error from our API contract.
export function extractApiError(err: unknown, fallback = 'Request failed'): string {
  if (typeof err === 'object' && err !== null && 'response' in err) {
    const r = (err as { response?: { data?: { error?: { message?: string } } } }).response;
    return r?.data?.error?.message ?? fallback;
  }
  return fallback;
}
