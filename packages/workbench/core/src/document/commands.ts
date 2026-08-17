import type { DtcgNode } from '../dtcg/parse';
import { emptyResolver, type ResolverDocument } from './resolver-types';
import type { Token } from './types';

/** A command describing one mutation of the document (ADR-0012). */
export interface AddTokenCommand {
  type: 'addToken';
  token: Token;
}

export interface UpdateTokenValueCommand {
  type: 'updateTokenValue';
  id: string;
  value: unknown;
}

export interface RemoveTokenCommand {
  type: 'removeToken';
  id: string;
}

/** Replace a whole token in one atomic step (buffered panel Save). `id` is always preserved. */
export interface ReplaceTokenCommand {
  type: 'replaceToken';
  id: string;
  token: Token;
}

/** Add a token set (a file). Empty sets are first-class and persist as empty files. */
export interface AddSetCommand {
  type: 'addSet';
  name: string;
}

/** Remove a token set and every token in it, in one undoable step. */
export interface RemoveSetCommand {
  type: 'removeSet';
  name: string;
}

/** Inverse of removeSet — restores the set name and its snapshotted tokens in one step. */
export interface RestoreSetCommand {
  type: 'restoreSet';
  name: string;
  tokens: Token[];
}

/**
 * Rename a token path, or a group prefix, across every set that carries it — rewriting the aliases
 * that target it. `allowGroup` is the caller's acknowledgement that this rewrites a whole subtree;
 * it rides IN the command so redo replays it and no driver can forget the check.
 */
export interface RenamePathCommand {
  type: 'renamePath';
  from: string[];
  to: string[];
  allowGroup?: boolean;
}

/**
 * Inverse of a rename: restores the pre-images of exactly the tokens it touched. A mirrored rename
 * would look symmetric and quietly corrupt any alias that pointed at the NEW path beforehand.
 */
/**
 * The universal inverse: restore these files to the trees they held before a command ran. A name
 * mapped to `undefined` did not exist and is deleted on restore.
 *
 * One snapshot inverts every command, including a rename that rewrote aliases across several sets.
 * That replaces per-command inverse logic entirely — the previous model needed a bespoke inverse
 * per command type and a plan snapshot for renames.
 */
export interface RestoreFilesCommand {
  type: 'restoreFiles';
  files: Record<string, DtcgNode | undefined>;
}

export interface RestoreTokensCommand {
  type: 'restoreTokens';
  tokens: Token[];
}

/** Move one or many tokens to a set; per-id targets so the inverse is symmetric. */
export interface MoveTokensCommand {
  type: 'moveTokens';
  moves: Array<{ id: string; set: string }>;
}

/** Add a resolver document (a `<name>.resolver.json` file). Empty resolvers are first-class. */
export interface AddResolverCommand {
  type: 'addResolver';
  name: string;
  doc: ResolverDocument;
}

/** Remove a resolver document in one undoable step. */
export interface RemoveResolverCommand {
  type: 'removeResolver';
  name: string;
}

/** Inverse of removeResolver — restores the name and its snapshotted document. */
export interface RestoreResolverCommand {
  type: 'restoreResolver';
  name: string;
  doc: ResolverDocument;
}

/** Replace a resolver's whole document (R2 panel edits route through this; coalesces per-name). */
export interface UpdateResolverCommand {
  type: 'updateResolver';
  name: string;
  doc: ResolverDocument;
}

export type Command =
  | AddTokenCommand
  | UpdateTokenValueCommand
  | RemoveTokenCommand
  | ReplaceTokenCommand
  | AddSetCommand
  | RemoveSetCommand
  | RenamePathCommand
  | RestoreSetCommand
  | RestoreTokensCommand
  | RestoreFilesCommand
  | MoveTokensCommand
  | AddResolverCommand
  | RemoveResolverCommand
  | RestoreResolverCommand
  | UpdateResolverCommand;

export function addToken(token: Token): AddTokenCommand {
  return { type: 'addToken', token };
}

export function updateTokenValue(
  id: string,
  value: unknown,
): UpdateTokenValueCommand {
  return { type: 'updateTokenValue', id, value };
}

export function removeToken(id: string): RemoveTokenCommand {
  return { type: 'removeToken', id };
}

export function replaceToken(id: string, token: Token): ReplaceTokenCommand {
  return { type: 'replaceToken', id, token };
}

export function renamePath(
  from: string[],
  to: string[],
  options: { allowGroup?: boolean } = {},
): RenamePathCommand {
  return { type: 'renamePath', from, to, allowGroup: options.allowGroup };
}

export function restoreFiles(
  files: Record<string, DtcgNode | undefined>,
): RestoreFilesCommand {
  return { type: 'restoreFiles', files };
}

export function restoreTokens(tokens: Token[]): RestoreTokensCommand {
  return { type: 'restoreTokens', tokens };
}

export function addSet(name: string): AddSetCommand {
  return { type: 'addSet', name };
}

export function removeSet(name: string): RemoveSetCommand {
  return { type: 'removeSet', name };
}

export function moveTokens(ids: string[], set: string): MoveTokensCommand {
  return { type: 'moveTokens', moves: ids.map((id) => ({ id, set })) };
}

export function addResolver(
  name: string,
  doc: ResolverDocument = emptyResolver(),
): AddResolverCommand {
  return { type: 'addResolver', name, doc };
}

export function removeResolver(name: string): RemoveResolverCommand {
  return { type: 'removeResolver', name };
}

export function updateResolver(
  name: string,
  doc: ResolverDocument,
): UpdateResolverCommand {
  return { type: 'updateResolver', name, doc };
}
