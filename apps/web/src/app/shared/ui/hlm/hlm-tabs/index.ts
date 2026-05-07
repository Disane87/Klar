export { HlmTabsDirective } from './hlm-tabs.directive';
export { HlmTabsListDirective } from './hlm-tabs-list.directive';
export { HlmTabsTriggerDirective } from './hlm-tabs-trigger.directive';
export { HlmTabsContentDirective } from './hlm-tabs-content.directive';

import { HlmTabsDirective } from './hlm-tabs.directive';
import { HlmTabsListDirective } from './hlm-tabs-list.directive';
import { HlmTabsTriggerDirective } from './hlm-tabs-trigger.directive';
import { HlmTabsContentDirective } from './hlm-tabs-content.directive';

export const HlmTabsImports = [
  HlmTabsDirective,
  HlmTabsListDirective,
  HlmTabsTriggerDirective,
  HlmTabsContentDirective,
] as const;
