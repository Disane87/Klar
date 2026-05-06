/**
 * OAuth 2.1 Scopes für den Klar MCP-Endpoint.
 * Single Source of Truth — wird sowohl vom API (Token-Issuance, Bearer-Guard,
 * MCP-Tool-Filter) als auch vom Frontend (Consent-Screen, Connected-Apps-UI)
 * importiert.
 */

export const OAUTH_SCOPES = [
  'klar:transactions:read',
  'klar:transactions:write',
  'klar:recurring:read',
  'klar:recurring:write',
  'klar:categories:read',
  'klar:categories:write',
  'klar:projects:read',
  'klar:projects:write',
  'klar:budgets:read',
  'klar:budgets:write',
  'klar:overview:read',
  'klar:household:read',
] as const;

export type OAuthScope = (typeof OAUTH_SCOPES)[number];

export function isOAuthScope(value: string): value is OAuthScope {
  return (OAUTH_SCOPES as readonly string[]).includes(value);
}

export function parseScopeString(scope: string): OAuthScope[] {
  const tokens = scope.split(/\s+/).filter((s) => s.length > 0);
  const result: OAuthScope[] = [];
  for (const token of tokens) {
    if (!isOAuthScope(token)) {
      throw new Error(`Unknown OAuth scope: ${token}`);
    }
    if (!result.includes(token)) {
      result.push(token);
    }
  }
  return result;
}

export function isScopeSubset(requested: readonly OAuthScope[], granted: readonly OAuthScope[]): boolean {
  return requested.every((s) => granted.includes(s));
}

export type ScopeDisplay = {
  title: string;
  desc: string;
  /** Iconify key (lucide). */
  icon: string;
};

export const SCOPE_DISPLAY: Record<OAuthScope, ScopeDisplay> = {
  'klar:transactions:read': {
    title: 'Buchungen lesen',
    desc: 'Alle deine Transaktionen sehen',
    icon: 'lucide:list',
  },
  'klar:transactions:write': {
    title: 'Buchungen anlegen',
    desc: 'Neue Transaktionen für dich erstellen',
    icon: 'lucide:plus',
  },
  'klar:recurring:read': {
    title: 'Fixkosten lesen',
    desc: 'Wiederkehrende Buchungen sehen',
    icon: 'lucide:repeat',
  },
  'klar:recurring:write': {
    title: 'Fixkosten anlegen',
    desc: 'Neue wiederkehrende Buchungen erstellen',
    icon: 'lucide:repeat-2',
  },
  'klar:categories:read': {
    title: 'Kategorien lesen',
    desc: 'Alle Kategorien deines Haushalts sehen',
    icon: 'lucide:tag',
  },
  'klar:categories:write': {
    title: 'Kategorien anlegen',
    desc: 'Neue Kategorien erstellen',
    icon: 'lucide:tags',
  },
  'klar:projects:read': {
    title: 'Projekte lesen',
    desc: 'Deine Projekte sehen',
    icon: 'lucide:folder',
  },
  'klar:projects:write': {
    title: 'Projekte anlegen',
    desc: 'Neue Projekte erstellen',
    icon: 'lucide:folder-plus',
  },
  'klar:budgets:read': {
    title: 'Budgets lesen',
    desc: 'Deine Budgets sehen',
    icon: 'lucide:wallet',
  },
  'klar:budgets:write': {
    title: 'Budgets setzen',
    desc: 'Budgets erstellen oder ändern',
    icon: 'lucide:wallet-cards',
  },
  'klar:overview:read': {
    title: 'Übersicht lesen',
    desc: 'Zusammenfassungen und Aggregate',
    icon: 'lucide:bar-chart-3',
  },
  'klar:household:read': {
    title: 'Haushalt lesen',
    desc: 'Basis-Infos zu deinem Haushalt',
    icon: 'lucide:home',
  },
};
