import type { CanonicalMappingResolver } from './accountingEngine';
import {
  CANONICAL_RESOLVER_CATALOG_V1_VERSION,
  createVersionedCanonicalResolver,
  type CanonicalResolverCatalog,
} from './canonicalResolverCatalog';
import { CANONICAL_RESOLVER_CATALOG_V1_DEFINITIONS } from './canonicalResolverCatalogV1.generated';

export const canonicalResolverCatalogV1: CanonicalResolverCatalog = Object.freeze({
  version: CANONICAL_RESOLVER_CATALOG_V1_VERSION,
  definitions: Object.freeze([...CANONICAL_RESOLVER_CATALOG_V1_DEFINITIONS]),
});

export const canonicalResolverCatalogV1Runtime = createVersionedCanonicalResolver(canonicalResolverCatalogV1);

/** Explicit adapter for the Phase 3 accounting-engine boundary. */
export const canonicalResolverCatalogV1Resolver: CanonicalMappingResolver = {
  version: CANONICAL_RESOLVER_CATALOG_V1_VERSION,
  resolve(entry) {
    const resolution = canonicalResolverCatalogV1Runtime.resolve(entry);
    if (resolution.status === 'unresolved') return { status: 'unmatched' };
    if (resolution.status === 'ambiguous') {
      return { status: 'ambiguous', ruleIds: resolution.definitions.map(definition => definition.resolverId) };
    }
    if (resolution.status === 'invalid') return { status: 'invalid', errors: resolution.errors };
    return {
      status: 'matched',
      ruleId: resolution.definition.resolverId,
      approvedVariantId: resolution.definition.approvedVariantId,
      posting: resolution.posting,
    };
  },
};
