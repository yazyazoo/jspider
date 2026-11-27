import { requireSiteDefinition } from '../catalog';
import type { SiteModule } from '../contracts';
import { titanHdAdapter } from './article';

export const titanHdModule: SiteModule = {
  definition: requireSiteDefinition('titanhd'),
  article: titanHdAdapter,
};
