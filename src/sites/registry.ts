import type { SearchProvider, SiteModule } from './contracts';
import { laForestaModule } from './laforestaincantata/module';
import { titanHdModule } from './titanhd/module';

export const siteModules: readonly SiteModule[] = [titanHdModule, laForestaModule];

export function resolveArticleModule(
  url: string,
  modules: readonly SiteModule[] = siteModules,
): SiteModule | null {
  const matches = modules.filter((module) => {
    try { return module.article?.matches(url) === true; } catch { return false; }
  });
  return matches.length === 1 ? matches[0]! : null;
}

export function listSearchProviders(
  modules: readonly SiteModule[] = siteModules,
): readonly SearchProvider[] {
  return modules.flatMap((module) => module.search ? [module.search] : []);
}

