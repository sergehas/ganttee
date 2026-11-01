/**
 * Ownership and lifetime rules for transient (non-document) Ganttee findings.
 *
 * Pure: no `vscode` imports. URIs are opaque strings. The host adapter feeds
 * document revisions and lifecycle events in, and reads the current transient
 * findings per URI out; this store decides which feedback is current.
 */

import { GantteeFinding, LabelSnapshot } from "@common/models/diagnostics";

/** Session-owned draft feedback contexts. */
export type DraftFeedbackContext = "entityDraft" | "settingsDraft";

/** One published group of transient findings with its own label context. */
export interface TransientFeedbackEntry {
  /** Structured findings. */
  readonly findings: readonly GantteeFinding[];
  /** Labels of the origin (draft, proposal, or pre-cleanup source). */
  readonly labels: LabelSnapshot;
  /** Stable logical operation key for operation entries; used by the dismiss action. */
  readonly operationKey?: string;
}

/** Options describing an observed document change. */
export interface DocumentChangeOptions {
  /** Whether the change is the automatic cleanup operation's own replacement. */
  readonly cleanup?: boolean;
}

/** Session-owned feedback slot (draft or rejected edit). */
interface SessionSlot {
  /** Revision the feedback was computed against. */
  readonly baseRevision: number;
  /** Published feedback. */
  readonly entry: TransientFeedbackEntry;
}

/** Per-session state. */
interface SessionState {
  /** Last accepted generation per draft context; survives clears. */
  readonly generations: Map<DraftFeedbackContext, number>;
  /** Current draft feedback per context. */
  readonly drafts: Map<DraftFeedbackContext, SessionSlot>;
  /** Current rejected-edit feedback per draft context. */
  readonly rejections: Map<DraftFeedbackContext, SessionSlot>;
}

/** Per-operation state. */
interface OperationState {
  /** Newest accepted attempt; survives clears and dismissal. */
  attempt: number;
  /** Current finding, when any. */
  entry?: TransientFeedbackEntry;
}

/** Per-URI state. */
interface UriState {
  /** Current document revision. */
  revision: number;
  /** Open sessions keyed by session id. */
  readonly sessions: Map<string, SessionState>;
  /** URI-owned operations keyed by operation key. */
  readonly operations: Map<string, OperationState>;
}

/**
 * Holds draft, rejected-edit, and operational findings and enforces their
 * ownership, generation, revision, expiry, and dismissal rules.
 */
export class TransientFeedbackStore {
  private readonly _uris = new Map<string, UriState>();
  private readonly _disposedSessions = new Set<string>();
  private readonly _listeners = new Set<(uri: string) => void>();

  /**
   * Subscribes to changes of the transient findings of any URI.
   *
   * @param listener Receives the URI whose findings changed.
   * @returns A function removing the subscription.
   */
  onDidChange(listener: (uri: string) => void): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  /**
   * Records an opened document revision without expiring anything.
   *
   * @param uri The document URI.
   * @param revision The current document revision.
   */
  openDocument(uri: string, revision: number): void {
    this.state(uri).revision = revision;
  }

  /**
   * Registers an editor session for a URI so its feedback can be accepted.
   *
   * @param uri The document URI.
   * @param sessionId The editor session id.
   */
  openSession(uri: string, sessionId: string): void {
    const state = this.state(uri);
    if (!state.sessions.has(sessionId) && !this._disposedSessions.has(sessionKey(uri, sessionId))) {
      state.sessions.set(sessionId, {
        generations: new Map(),
        drafts: new Map(),
        rejections: new Map(),
      });
    }
  }

  /**
   * Replaces (or clears, when `findings` is empty) one session's draft feedback.
   * Ignored for unknown or disposed sessions, older or duplicate generations,
   * and base revisions other than the current one.
   *
   * @returns Whether the feedback was accepted.
   */
  reportDraft(
    uri: string,
    sessionId: string,
    context: DraftFeedbackContext,
    generation: number,
    baseRevision: number,
    findings: readonly GantteeFinding[],
    labels: LabelSnapshot,
  ): boolean {
    const state = this._uris.get(uri);
    const session = state?.sessions.get(sessionId);
    if (state === undefined || session === undefined) {
      return false;
    }
    if (generation <= (session.generations.get(context) ?? -Infinity)) {
      return false;
    }
    if (baseRevision !== state.revision) {
      return false;
    }
    session.generations.set(context, generation);
    session.rejections.delete(context);
    if (findings.length === 0) {
      session.drafts.delete(context);
    } else {
      session.drafts.set(context, { baseRevision, entry: { findings, labels } });
    }
    this.fire(uri);
    return true;
  }

  /**
   * Publishes host-side rejected-edit findings for a session's draft context,
   * labeled with the rejected proposal. Empty findings clear it.
   *
   * @returns Whether the feedback was accepted.
   */
  reportRejectedEdit(
    uri: string,
    sessionId: string,
    context: DraftFeedbackContext,
    baseRevision: number,
    findings: readonly GantteeFinding[],
    labels: LabelSnapshot,
  ): boolean {
    const state = this._uris.get(uri);
    const session = state?.sessions.get(sessionId);
    if (state === undefined || session === undefined || baseRevision !== state.revision) {
      return false;
    }
    if (findings.length === 0) {
      session.rejections.delete(context);
    } else {
      session.rejections.set(context, { baseRevision, entry: { findings, labels } });
    }
    this.fire(uri);
    return true;
  }

  /**
   * Returns the next attempt generation for a host-originated operation.
   *
   * @param uri The document URI.
   * @param operationKey The stable logical operation key.
   * @returns A strictly increasing attempt number.
   */
  nextAttempt(uri: string, operationKey: string): number {
    return (this._uris.get(uri)?.operations.get(operationKey)?.attempt ?? 0) + 1;
  }

  /**
   * Replaces (or clears, when `findings` is empty) a URI-owned operation's
   * finding. Only an attempt newer than every previous attempt is accepted.
   *
   * @returns Whether the result was accepted.
   */
  reportOperation(
    uri: string,
    operationKey: string,
    attempt: number,
    findings: readonly GantteeFinding[],
    labels: LabelSnapshot,
  ): boolean {
    const state = this._uris.get(uri);
    if (state === undefined) {
      return false;
    }
    const operation = state.operations.get(operationKey) ?? { attempt: 0 };
    if (attempt <= operation.attempt) {
      return false;
    }
    operation.attempt = attempt;
    operation.entry = findings.length === 0 ? undefined : { findings, labels, operationKey };
    state.operations.set(operationKey, operation);
    this.fire(uri);
    return true;
  }

  /**
   * Clears only the current finding of one operation; older attempts cannot
   * restore it, and a newer attempt may publish again.
   *
   * @returns Whether a finding was cleared.
   */
  dismissOperation(uri: string, operationKey: string): boolean {
    const operation = this._uris.get(uri)?.operations.get(operationKey);
    if (operation?.entry === undefined) {
      return false;
    }
    operation.entry = undefined;
    this.fire(uri);
    return true;
  }

  /**
   * Applies revision rules after an observed TextDocument change: draft and
   * rejected-edit feedback from older revisions is cleared; operation findings
   * expire unless the change is the cleanup operation's own replacement.
   *
   * @param uri The document URI.
   * @param revision The new document revision.
   * @param options Change classification.
   */
  noteDocumentChange(uri: string, revision: number, options: DocumentChangeOptions = {}): void {
    const state = this._uris.get(uri);
    if (state === undefined) {
      return;
    }
    state.revision = revision;
    let changed = false;
    for (const session of state.sessions.values()) {
      for (const slots of [session.drafts, session.rejections]) {
        for (const [context, slot] of slots) {
          if (slot.baseRevision < revision) {
            slots.delete(context);
            changed = true;
          }
        }
      }
    }
    if (options.cleanup !== true) {
      for (const operation of state.operations.values()) {
        if (operation.entry !== undefined) {
          operation.entry = undefined;
          changed = true;
        }
      }
    }
    if (changed) {
      this.fire(uri);
    }
  }

  /**
   * Clears session-owned feedback when an editor session ends. URI-owned
   * operation findings survive.
   *
   * @param uri The document URI.
   * @param sessionId The ended session.
   */
  disposeSession(uri: string, sessionId: string): void {
    this._disposedSessions.add(sessionKey(uri, sessionId));
    const state = this._uris.get(uri);
    if (state?.sessions.delete(sessionId) === true) {
      this.fire(uri);
    }
  }

  /**
   * Clears every transient finding owned by a closed document.
   *
   * @param uri The closed document URI.
   */
  clearUri(uri: string): void {
    if (this._uris.delete(uri)) {
      this.fire(uri);
    }
  }

  /**
   * Returns the current transient findings of a URI.
   *
   * @param uri The document URI.
   * @returns Entries in stable order: sessions (drafts, rejections), then operations.
   */
  entries(uri: string): readonly TransientFeedbackEntry[] {
    const state = this._uris.get(uri);
    if (state === undefined) {
      return [];
    }
    const result: TransientFeedbackEntry[] = [];
    for (const session of state.sessions.values()) {
      for (const slot of [...session.drafts.values(), ...session.rejections.values()]) {
        result.push(slot.entry);
      }
    }
    for (const operation of state.operations.values()) {
      if (operation.entry !== undefined) {
        result.push(operation.entry);
      }
    }
    return result;
  }

  /** Returns (creating when needed) the state of a URI. */
  private state(uri: string): UriState {
    let state = this._uris.get(uri);
    if (state === undefined) {
      state = { revision: 0, sessions: new Map(), operations: new Map() };
      this._uris.set(uri, state);
    }
    return state;
  }

  /** Notifies listeners that a URI's transient findings changed. */
  private fire(uri: string): void {
    for (const listener of [...this._listeners]) {
      listener(uri);
    }
  }
}

/** Builds the disposed-session key of a URI-scoped session. */
function sessionKey(uri: string, sessionId: string): string {
  return `${uri}\u0000${sessionId}`;
}
