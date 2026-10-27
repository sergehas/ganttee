/** Serializes host document edits by document URI. */
export class DocumentEditQueue {
  /** Latest completion promise for each document with queued work. */
  private readonly _pending = new Map<string, PendingDocumentEdit>();

  /** Runs one operation after earlier operations for the same document. */
  run<T>(documentKey: string, operation: () => T | Promise<T>): Promise<T> {
    const previous = this._pending.get(documentKey)?.completion ?? Promise.resolve();
    const result = previous.then(operation);
    const token = Symbol();
    const settled = result.then(
      () => this.removeCompleted(documentKey, token),
      () => this.removeCompleted(documentKey, token),
    );
    this._pending.set(documentKey, { completion: settled, token });
    return result;
  }

  /** Serializes a revision-bound edit and rejects it if an earlier edit made it stale. */
  runRevisioned(
    documentKey: string,
    baseRevision: number,
    getCurrentRevision: () => number,
    operation: () => boolean | Promise<boolean>,
    onStale: () => void,
  ): Promise<boolean> {
    return this.run(documentKey, async () => {
      if (getCurrentRevision() !== baseRevision) {
        onStale();
        return false;
      }
      return operation();
    });
  }

  /** Removes a settled queue entry only when no later operation replaced it. */
  private removeCompleted(documentKey: string, token: symbol): void {
    if (this._pending.get(documentKey)?.token === token) {
      this._pending.delete(documentKey);
    }
  }
}

/** Queue tail and identity token for pending edits to one document. */
interface PendingDocumentEdit {
  /** Promise that settles when all currently queued edits finish. */
  readonly completion: Promise<void>;
  /** Identity used to avoid deleting a newer queue tail during cleanup. */
  readonly token: symbol;
}
