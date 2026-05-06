// Re-export shared scope types so backend code uses the same SoT as the frontend.
export {
  OAUTH_SCOPES,
  SCOPE_DISPLAY,
  isOAuthScope,
  isScopeSubset,
  parseScopeString,
} from '@klar/shared';
export type { OAuthScope, ScopeDisplay } from '@klar/shared';
