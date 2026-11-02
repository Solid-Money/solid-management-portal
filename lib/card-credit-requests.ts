/**
 * The request id of every card credit grant or removal not yet confirmed by
 * the server, keyed by what reaches it: user, mode, amount and trimmed reason.
 *
 * Kept outside the adjust dialog, which unmounts on close: an admin whose
 * grant went through but whose response was lost can close it, reopen it,
 * send the same thing again and still move the credit only once, because the
 * backend answers a repeated id as a repeat.
 *
 * An id is dropped by {@link confirmCardCreditRequest}, called from the
 * mutation's own success handler, which runs even when the dialog has
 * unmounted. Leaving a confirmed id here would turn a later, deliberate
 * adjustment with the same details into a "repeat" that moves nothing.
 */
const unconfirmed = new Map<string, string | undefined>();

/**
 * None where the browser can't make a UUID: the adjustment then goes without
 * one, as before.
 */
const newRequestId = (): string | undefined =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : undefined;

/** This submission's id: the one already sent for it, or a new one. */
export function cardCreditRequestId(key: string): string | undefined {
  if (!unconfirmed.has(key)) unconfirmed.set(key, newRequestId());
  return unconfirmed.get(key);
}

/** The server confirmed this id: a new submission gets a new one. */
export function confirmCardCreditRequest(requestId: string | undefined): void {
  if (!requestId) return;
  for (const [key, id] of unconfirmed) {
    if (id === requestId) unconfirmed.delete(key);
  }
}
