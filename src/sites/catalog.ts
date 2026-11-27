import catalog from './catalog.json';
import type { SiteDefinition } from './contracts';

export const siteDefinitions: readonly SiteDefinition[] = catalog;

export function requireSiteDefinition(siteId: string): SiteDefinition {
  const definition = siteDefinitions.find((candidate) => candidate.siteId === siteId);
  if (!definition) throw new Error(`Unknown site definition: ${siteId}`);
  return definition;
}
