import type { DtcgNode } from '../dtcg/parse';
import { parseCollection } from '../dtcg/parse';
import { parseResolver, serializeResolver } from '../dtcg/resolver';
import { DEFAULT_SET, tokenNode } from '../dtcg/serialize';
import {
  cloneNode,
  deleteNodeAt,
  getNodeAt,
  pruneEmptyAncestors,
  setNodeAt,
} from '../dtcg/tree';
import type { TokenCodec } from './codec';
import type { Command } from './commands';
import {
  isResolverFile,
  partition,
  resolverFileName,
  resolverFromFileName,
  setFileName,
  setFromFileName,
} from './files';
import { parseTokenId, tokenId } from './identity';
import { planRename, type RenamePlan } from './rename';
import type { ResolverDocument } from './resolver-types';
import type { Token } from './types';

export type ChangeListener = () => void;

export interface Document {
  apply(command: Command): void;
  undo(): void;
  redo(): void;
  /**
   * End the current coalescing run, so the next edit — even to the same target —
   * starts a fresh undo entry. Call on blur / focus-change / an edit panel commit.
   * No-op if nothing is pending; never touches document state.
   */
  commitEdit(): void;
  /** Seed the document from parsed DTCG files, keyed by file name; clears history. */
  hydrate(files: Record<string, DtcgNode>): void;
  /** The raw files — the document's actual state, and the write path. */
  getFiles(): Record<string, DtcgNode>;
  getToken(id: string): Token | undefined;
  getAllTokens(): Token[];
  /** The authoritative set list (insertion order); stable ref between mutations. */
  getSets(): string[];
  /** The authoritative resolver map by name; stable ref between mutations. */
  getResolvers(): Map<string, ResolverDocument>;
  /** A counter that increments on every mutation — lets callers detect unsaved changes. */
  getVersion(): number;
  subscribe(listener: ChangeListener): () => void;
  /**
   * Drop the derived-view caches and notify subscribers WITHOUT counting as a mutation. The token
   * view depends on an external input — the registered codecs — so the kernel calls this when one
   * registers after hydration. Not a version bump: nothing on disk changed, and a runner must not
   * mistake a registration for an edit to persist.
   */
  invalidateDerived(): void;
}

/**
 * The document holds the parsed DTCG files, untransformed — the file IS the model (ADR-0008 seam,
 * spec 2026-08-08). `Token[]`, the set list, and the resolver map are cached derived views over it.
 *
 * The previous model held a flat `Token[]` and rebuilt each file on write, which silently discarded
 * anything a token could not represent: a group's `$type`, `$description`, and `$extensions`, and
 * every DTCG or vendor key nobody had modelled. Holding the tree makes that loss impossible rather
 * than fixing it case by case.
 */
export function createDocument(options?: {
  /**
   * Lazy supplier of the registered token codecs (extension-held token data). Lazy so the kernel
   * can wire the registry it creates alongside the document; consulted on every derivation and
   * every codec-aware write.
   */
  codecs?: () => TokenCodec[];
}): Document {
  const codecList = (): TokenCodec[] => options?.codecs?.() ?? [];
  const codecLookup = {
    get: (key: string) => codecList().find((codec) => codec.key === key),
  };
  const files = new Map<string, DtcgNode>();
  // Each undo entry pairs the forward command with its inverse, so undo applies
  // the inverse and redo re-applies the forward command (ADR-0012).
  const undoStack: Array<{ command: Command; inverse: Command }> = [];
  const redoStack: Array<{ command: Command; inverse: Command }> = [];
  // The coalesce key of the run currently open at the top of the undo stack; null = sealed.
  let lastKey: string | null = null;
  const listeners = new Set<ChangeListener>();
  let version = 0;
  // Derived views, invalidated on every mutation so each returns a stable reference between
  // changes (safe for useSyncExternalStore, incl. the load→subscribe gap).
  let tokenList: Token[] | null = null;
  let setsList: string[] | null = null;
  let resolversSnapshot: Map<string, ResolverDocument> | null = null;

  function record(): Record<string, DtcgNode> {
    return Object.fromEntries(files);
  }

  function emit(): void {
    version++;
    tokenList = null;
    setsList = null;
    resolversSnapshot = null;
    for (const listener of listeners) listener();
  }

  function allTokens(): Token[] {
    if (tokenList === null)
      tokenList = parseCollection(partition(record()).sets, codecList());
    return tokenList;
  }

  /** The tree for a set, created on demand so a write to a new set does not silently vanish. */
  function setTree(set: string): DtcgNode {
    const name = setFileName(set);
    const existing = files.get(name);
    if (existing) return existing;
    const created: DtcgNode = {};
    files.set(name, created);
    return created;
  }

  /**
   * Files a command may touch, snapshotted before it runs. `renamePath` is deliberately
   * conservative: an alias to the renamed path can live in any set, so a rename snapshots them all.
   */
  function touched(command: Command): string[] {
    const setFiles = () =>
      [...files.keys()].filter((name) => !isResolverFile(name));

    switch (command.type) {
      case 'addToken':
        return [setFileName(command.token.set ?? DEFAULT_SET)];
      case 'updateTokenValue':
      case 'removeToken':
        return [setFileName(parseTokenId(command.id).set)];
      case 'replaceToken':
        return setFiles();
      case 'addSet':
      case 'removeSet':
      case 'restoreSet':
        return [setFileName(command.name)];
      case 'renamePath':
      case 'restoreTokens':
      case 'moveTokens':
        return setFiles();
      case 'addResolver':
      case 'removeResolver':
      case 'restoreResolver':
      case 'updateResolver':
        return [resolverFileName(command.name)];
      case 'restoreFiles':
        return Object.keys(command.files);
    }
  }

  function snapshot(names: string[]): Record<string, DtcgNode | undefined> {
    const out: Record<string, DtcgNode | undefined> = {};
    for (const name of names) {
      const tree = files.get(name);
      out[name] = tree ? cloneNode(tree) : undefined;
    }
    return out;
  }

  /** Write a token's node at the location its id names — carrier form for codec-owned tokens. */
  function writeToken(token: Token): void {
    setNodeAt(
      setTree(token.set ?? DEFAULT_SET),
      token.path,
      tokenNode(token, codecLookup),
    );
  }

  /**
   * Patch a token node's value in place, carrier-aware. On an ordinary node this is the historical
   * `$value` write; on a carrier (extension-held token data) writing `$value` beside the payload
   * would corrupt the store — a malformed half-token next to stale data — so the payload is
   * re-serialized through its codec instead.
   */
  function patchTokenValue(
    node: DtcgNode,
    value: unknown,
    at: { set: string; path: string[] },
  ): void {
    const ext = node.$extensions as DtcgNode | undefined;
    if (ext && !('$value' in node) && !('$ref' in node)) {
      for (const codec of codecList()) {
        if (!(codec.key in ext)) continue;
        const fields = codec.materialize(ext[codec.key], at);
        if (!fields) break;
        ext[codec.key] = codec.serialize({
          id: tokenId(at.set, at.path),
          path: at.path,
          type: fields.type,
          value,
          set: at.set,
          codec: codec.key,
          codecSource: ext[codec.key],
          ...(fields.description !== undefined
            ? { description: fields.description }
            : {}),
        });
        return;
      }
    }
    node.$value = value;
    delete node.$ref; // $value XOR $ref — an edited reference becomes a literal
  }

  /** Token-set file names, in insertion order. */
  function tokenFiles(): string[] {
    return [...files.keys()].filter((name) => !isResolverFile(name));
  }

  /**
   * Apply a rename by moving the NODE at `from` to `to` in every set that has one.
   *
   * Moving the node rather than each token individually is what carries a group's own `$type`,
   * `$description`, and `$extensions` across — moving tokens one at a time stranded them at the old
   * path and silently untyped everything beneath the new one.
   *
   * Alias values are rewritten FIRST, at their current locations. An alias living inside the group
   * being renamed would otherwise be looked up at a path the move had already vacated, and skipped
   * without a word; rewriting before the move means it simply travels with its node.
   */
  function applyPlan(plan: RenamePlan, from: string[], to: string[]): void {
    for (const { id, value, ref } of plan.rewritten) {
      const { set, path } = parseTokenId(id);
      const node = getNodeAt(setTree(set), path);
      if (!node) continue;
      if (ref !== undefined) node.$ref = ref;
      // Carrier-aware: an alias living INSIDE a codec payload is rewritten through its codec,
      // never as a stray `$value` beside the payload.
      else patchTokenValue(node, value, { set, path });
    }

    for (const name of tokenFiles()) {
      const tree = files.get(name);
      if (!tree) continue;
      const node = getNodeAt(tree, from);
      if (!node) continue;

      const moved = cloneNode(node);
      deleteNodeAt(tree, from);
      setNodeAt(tree, to, moved);
      // After the destination exists, so a shared parent is never seen as momentarily empty.
      pruneEmptyAncestors(tree, from);
    }
  }

  function execute(command: Command): void {
    switch (command.type) {
      case 'addToken':
        writeToken(command.token);
        break;
      case 'updateTokenValue': {
        const { set, path } = parseTokenId(command.id);
        const node = getNodeAt(setTree(set), path);
        if (node) {
          patchTokenValue(node, command.value, { set, path });
        }
        break;
      }
      case 'removeToken': {
        const { set, path } = parseTokenId(command.id);
        const tree = setTree(set);
        deleteNodeAt(tree, path);
        pruneEmptyAncestors(tree, path);
        break;
      }
      case 'replaceToken': {
        const { set, path: from } = parseTokenId(command.id);
        const to = command.token.path;
        // A path change IS a rename: repath the same path in every other set and rewrite the
        // aliases that targeted it, so one Save can never leave a reference dangling.
        const renamed = from.join('.') !== to.join('.');
        const plan = renamed ? planRename(allTokens(), from, to) : null;
        // Refuse the WHOLE command on collision. Applying the swap and skipping only the plan
        // would create the very collision the guard exists to prevent.
        if (plan && plan.collisions.length > 0) break;
        if (plan) {
          applyPlan(plan, from, to);
          // The plan moved the node; overwrite it with the command's content at the new path.
          setNodeAt(
            setTree(set),
            to,
            tokenNode({ ...command.token, set }, codecLookup),
          );
        } else {
          setNodeAt(
            setTree(set),
            from,
            tokenNode({ ...command.token, set }, codecLookup),
          );
        }
        break;
      }
      case 'addSet':
        setTree(command.name);
        break;
      case 'removeSet':
        files.delete(setFileName(command.name));
        break;
      case 'restoreSet':
        for (const token of command.tokens) writeToken(token);
        break;
      case 'restoreTokens':
        for (const token of command.tokens) writeToken(token);
        break;
      case 'restoreFiles':
        for (const [name, tree] of Object.entries(command.files)) {
          if (tree) files.set(name, tree);
          else files.delete(name);
        }
        break;
      case 'renamePath': {
        const plan = planRename(allTokens(), command.from, command.to);
        // Guards live here so a driver that skips its own checks still cannot write corrupt state.
        if (plan.collisions.length > 0) break;
        if (plan.isGroup && !command.allowGroup) break;
        applyPlan(plan, command.from, command.to);
        break;
      }
      case 'moveTokens':
        for (const { id, set } of command.moves) {
          const { set: from, path } = parseTokenId(id);
          if (from === set) continue;
          const node = getNodeAt(setTree(from), path);
          if (!node) continue;
          const moved = cloneNode(node);
          const source = setTree(from);
          deleteNodeAt(source, path);
          pruneEmptyAncestors(source, path);
          setNodeAt(setTree(set), path, moved);
        }
        break;
      case 'addResolver':
      case 'restoreResolver':
      case 'updateResolver':
        files.set(
          resolverFileName(command.name),
          serializeResolver(command.doc),
        );
        break;
      case 'removeResolver':
        files.delete(resolverFileName(command.name));
        break;
    }
  }

  /** Key identifying a coalescable run; null = a command that never coalesces. */
  function coalesceKey(command: Command): string | null {
    switch (command.type) {
      case 'updateTokenValue':
        return `u:${command.id}`;
      case 'updateResolver':
        return `r:${command.name}`;
      default:
        return null; // structural + one-shot commands never coalesce
    }
  }

  return {
    apply(command) {
      const key = coalesceKey(command);
      const top = undoStack[undoStack.length - 1];
      if (key !== null && key === lastKey && top) {
        // Fold into the open run: advance the forward command, keep the original
        // inverse so undo rewinds the whole run to its pre-typing state.
        execute(command);
        top.command = command;
      } else {
        // One file snapshot inverts every command — including a rename that rewrote aliases across
        // several sets, which previously needed bespoke inverse logic and a plan snapshot.
        const inverse: Command = {
          type: 'restoreFiles',
          files: snapshot(touched(command)),
        };
        execute(command);
        undoStack.push({ command, inverse });
      }
      redoStack.length = 0;
      lastKey = key;
      emit();
    },
    undo() {
      const entry = undoStack.pop();
      if (!entry) return;
      // Capture the post-command state so redo can put it back, then rewind.
      const forward: Command = {
        type: 'restoreFiles',
        files: snapshot(
          Object.keys((entry.inverse as { files: object }).files),
        ),
      };
      execute(entry.inverse);
      redoStack.push({ command: forward, inverse: entry.inverse });
      lastKey = null;
      emit();
    },
    redo() {
      const entry = redoStack.pop();
      if (!entry) return;
      const back: Command = {
        type: 'restoreFiles',
        files: snapshot(
          Object.keys((entry.command as { files: object }).files),
        ),
      };
      execute(entry.command);
      undoStack.push({ command: entry.command, inverse: back });
      lastKey = null;
      emit();
    },
    commitEdit() {
      lastKey = null;
    },
    hydrate(seed) {
      files.clear();
      for (const [name, tree] of Object.entries(seed)) files.set(name, tree);
      undoStack.length = 0;
      redoStack.length = 0;
      lastKey = null;
      emit();
    },
    getFiles() {
      return record();
    },
    getToken(id) {
      return allTokens().find((token) => token.id === id);
    },
    getAllTokens() {
      return allTokens();
    },
    getSets() {
      if (setsList === null) {
        setsList = [...files.keys()]
          .filter((name) => !isResolverFile(name))
          .map(setFromFileName);
      }
      return setsList;
    },
    getResolvers() {
      if (resolversSnapshot === null) {
        resolversSnapshot = new Map(
          Object.entries(partition(record()).resolvers).map(([name, node]) => [
            resolverFromFileName(name),
            parseResolver(node),
          ]),
        );
      }
      return resolversSnapshot;
    },
    getVersion() {
      return version;
    },
    invalidateDerived() {
      tokenList = null;
      setsList = null;
      resolversSnapshot = null;
      for (const listener of listeners) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export { tokenId };
