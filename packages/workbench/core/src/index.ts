export { dtcg } from './api';
export type { ConfigStore, ScopedConfig } from './config/config-store';
export { createConfigStore, scopedConfig } from './config/config-store';
// The config engine: resolving and composing a consumer's config is system behaviour, not
// presentation. `vertekum/config` re-exports these for consumers' `vertekum.config.ts` files.
export type {
  ExtensionEntry,
  SchemaGroup,
  SchemaUse,
  VertekumConfig,
  VertekumConfigEnv,
  VertekumConfigInput,
} from './config/define-config';
export {
  defineConfig,
  mergeVertekumConfig,
  normalizeExtensions,
  resolveVertekumConfig,
} from './config/define-config';
export type {
  ActivateContext,
  ActivationEvent,
  ExtensionManifest,
  ExtensionSettings,
  ExtensionSettingsInput,
} from './config/manifest';
export { ExtensionManifestSchema } from './config/manifest';
export type { TokenCodec, TokenCodecService } from './document/codec';
export {
  createTokenCodecRegistry,
  TOKEN_CODEC_SERVICE,
} from './document/codec';
export type {
  AddResolverCommand,
  AddTokenCommand,
  Command,
  RemoveResolverCommand,
  RemoveTokenCommand,
  RenamePathCommand,
  ReplaceTokenCommand,
  RestoreResolverCommand,
  RestoreTokensCommand,
  UpdateResolverCommand,
  UpdateTokenValueCommand,
} from './document/commands';
export {
  addResolver,
  addSet,
  addToken,
  moveTokens,
  removeResolver,
  removeSet,
  removeToken,
  renamePath,
  replaceToken,
  restoreFiles,
  restoreTokens,
  updateResolver,
  updateTokenValue,
} from './document/commands';
export type { ChangeListener, Document } from './document/document';
export { createDocument } from './document/document';
export { isResolverFile, setFromFileName } from './document/files';
export { parseTokenId, tokenId } from './document/identity';
export type { RenamePlan } from './document/rename';
export { planRename } from './document/rename';
export type {
  ResolverDocument,
  ResolverIssue,
  ResolverIssueCode,
  ResolverModifier,
  ResolverSelection,
  ResolverSet,
  Source,
  SourceRef,
} from './document/resolver-types';
export { emptyResolver } from './document/resolver-types';
export type { Token } from './document/types';
export type { DtcgNode } from './dtcg/parse';
export { parseCollection, ROOT_TOKEN, VTK_PREFIX } from './dtcg/parse';
export { parseResolver, serializeResolver } from './dtcg/resolver';
export {
  DEFAULT_SET,
  interchangeFiles,
  serializeCollection,
  serializeSets,
  tokenNode,
} from './dtcg/serialize';
export type {
  Exporter,
  ExporterInput,
  ExporterService,
  OutputFile,
} from './export/exporter';
export { EXPORTER_SERVICE } from './export/exporter';
export { createExporterRegistry } from './export/registry';
export { resolveExporterInput } from './export/resolve-input';
export type { Target, TargetResult } from './export/target';
export { runTargets, targetId } from './export/target';
export type { Kernel } from './kernel';
export { createKernel } from './kernel';
export type { ScaleExpression, ScaleResult } from './scale/scale';
export { evaluateScale } from './scale/scale';
export { createCommandRegistry } from './shell/command-registry';
export type {
  ConfigurableExtension,
  ConfiguredExtension,
} from './shell/define-extension';
export { defineExtension } from './shell/define-extension';
export type { LocationService } from './shell/location';
export { LOCATION_SERVICE } from './shell/location';
export { createServiceRegistry } from './shell/service-registry';
export type {
  CommandArg,
  CommandContext,
  CommandDescriptor,
  CommandRegistry,
  CommandResult,
  Extension,
  ExtensionContext,
  ExtensionContributions,
  InstalledExtension,
  ServiceRegistry,
} from './shell/types';
export type { FileStore, StorageProvider } from './storage/provider';
export { createStorageProvider, serializeDocument } from './storage/provider';
export { allowedNamesAt } from './validate/allowed-names';
export type { AssembledSchemas } from './validate/assemble';
export { assembleBindings } from './validate/assemble';
export type { SchemaBindingService } from './validate/binding-registry';
export {
  createSchemaBindingRegistry,
  SCHEMA_BINDING_SERVICE,
} from './validate/binding-registry';
export {
  aliasValidator,
  builtinValidators,
  resolverValidator,
  targetValidator,
} from './validate/builtin-validators';
export {
  DTCG_RESOLVER_SCHEMA,
  DTCG_TOKEN_SCHEMA,
} from './validate/dtcg-schema';
export { DTCG_ANCHOR_ID, isPatchDocument } from './validate/extend';
export { createValidatorRegistry } from './validate/registry';
export type { SchemaBinding } from './validate/schema';
export { defaultBindings, validateFiles } from './validate/schema';
export type {
  Diagnostic,
  ValidationInput,
  Validator,
  ValidatorService,
} from './validate/validator';
export { VALIDATOR_SERVICE } from './validate/validator';
export {
  builtinCommands,
  groupVerbs,
  setVerbs,
  tokenVerbs,
} from './verbs/index';
export type { ChangeKind, Severity, TokenChange } from './versioning/diff';
export { diffTokens, suggestBump } from './versioning/diff';
export type { ReleaseNotes } from './versioning/notes';
export { buildReleaseNotes, nextVersion } from './versioning/notes';
export type {
  Baseline,
  ReleaseArtifacts,
  ReleaseProvider,
} from './versioning/release-provider';
