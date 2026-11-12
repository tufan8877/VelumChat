// Keep unchanged server records stable so polling does not rebuild the UI.
export function reconcileRecords<T extends { id: number }>(previous: T[], incoming: T[]): T[] {
  const byId = new Map(previous.map((record) => [record.id, record]));
  const next = incoming.map((record) => {
    const existing = byId.get(record.id);
    return existing && JSON.stringify(existing) === JSON.stringify(record) ? existing : record;
  });
  return next.length === previous.length && next.every((record, index) => record === previous[index])
    ? previous
    : next;
}
