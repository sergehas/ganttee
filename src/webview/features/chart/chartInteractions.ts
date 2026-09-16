/** Returns whether a chart event requests a direct date edit. */
export function isDirectEditGesture(params: unknown): boolean {
  const event = params as {
    event?: {
      event?: {
        ctrlKey?: boolean;
        metaKey?: boolean;
      };
    };
  };
  return Boolean(event.event?.event?.ctrlKey || event.event?.event?.metaKey);
}
