/**
 * Single source of truth for in-app navigation items.
 *
 * Both the desktop side-nav (≥ 768 px) and the mobile "Mehr" overflow
 * page (< 768 px) used to keep their own copies, which drifted (the
 * Banken entry was a recent example). This registry consolidates them.
 *
 * Tone mapping is taken verbatim from the Klar Design Pearl bundle
 * (klar/project/app.jsx).
 *
 * Where each consumer renders what:
 * - Bottom-nav (mobile, fixed 4 slots): owns its own short list and is
 *   not driven by this registry. Items here flagged `inBottomNav` are
 *   the ones it shows.
 * - Side-nav (desktop, two groups): every item, grouped by `section`.
 *   Admin item only when `auth.isAdmin()`.
 * - Mehr page (mobile, two groups): every item EXCEPT `inBottomNav`,
 *   grouped by `section`. Admin item only when `auth.isAdmin()`.
 */
export interface NavItem {
  id: string;
  label: string;
  icon: string;
  route: string;
  /** Category tone CSS var painting the active-state border, glow, and icon hover. */
  tone: string;
  /** Side-nav grouping ("Haushalt" vs "System"). */
  section: 'main' | 'system';
  /**
   * Already prominent in the mobile bottom-nav. Skip on the mobile
   * overflow ("Mehr") page; the desktop side-nav still shows it.
   */
  inBottomNav?: boolean;
  /** Duplicate alias only on the mobile Mehr page (e.g. Daueraufträge → Buchungen). */
  mehrOnly?: boolean;
  /** Hide for non-admin users. */
  adminOnly?: boolean;
}

export const NAV_ITEMS: readonly NavItem[] = [
  // Main / Haushalt
  { id: 'fixkosten', label: 'Fixkosten',    icon: 'fixkosten',     route: '/app/fixkosten', tone: 'var(--cat-abos)',     section: 'main', inBottomNav: true },
  { id: 'monat',     label: 'Cashflow',     icon: 'trending',      route: '/app/monat',     tone: 'var(--cat-essen)',    section: 'main', inBottomNav: true },
  { id: 'projekte',  label: 'Projekte',     icon: 'folder',        route: '/app/projekte',  tone: 'var(--cat-freizeit)', section: 'main', inBottomNav: true },
  { id: 'buchungen', label: 'Buchungen',    icon: 'receipt',       route: '/app/buchungen', tone: 'var(--cat-mobil)',    section: 'main' },
  { id: 'kalender',  label: 'Kalender',     icon: 'planspiel',     route: '/app/kalender',  tone: 'var(--cat-mobil)',    section: 'main' },
  { id: 'statistik', label: 'Statistik',    icon: 'trending',      route: '/app/statistik', tone: 'var(--cat-freizeit)', section: 'main' },
  { id: 'vertraege', label: 'Verträge',     icon: 'shield',        route: '/app/vertraege', tone: 'var(--cat-versicher)', section: 'main' },
  { id: 'recurring', label: 'Daueraufträge', icon: 'wiederkehrend', route: '/app/daueraufträge', tone: 'var(--cat-versicher)', section: 'main' },
  { id: 'planspiel', label: 'Planspiel',    icon: 'planspiel',     route: '/app/planspiel', tone: 'var(--cat-abos)',     section: 'main' },
  { id: 'tresor',    label: 'Tresor',       icon: 'tresor',        route: '/app/tresor',    tone: 'var(--cat-spar)',     section: 'main' },
  { id: 'banken',    label: 'Banken',       icon: 'wallet',        route: '/app/banken',    tone: 'var(--cat-gesund)',   section: 'main' },
  { id: 'import',    label: 'CSV-Import',   icon: 'receipt',       route: '/app/import',    tone: 'var(--cat-gesund)',   section: 'main' },

  // System
  { id: 'haushalt',  label: 'Haushalt',      icon: 'haushalt', route: '/app/haushalt', tone: 'var(--cat-essen)',    section: 'system' },
  { id: 'settings',  label: 'Einstellungen', icon: 'settings', route: '/app/settings', tone: 'var(--cat-spar)',     section: 'system' },
  { id: 'health',    label: 'System-Status', icon: 'pulse',    route: '/app/health',   tone: 'var(--cat-wohnen)',   section: 'system' },
  { id: 'admin',     label: 'Admin',         icon: 'shield',   route: '/app/admin',    tone: 'var(--cat-mobil)',    section: 'system', adminOnly: true },
];

/**
 * Items the desktop side-nav renders. Bottom-nav shortcuts are included
 * (desktop has no bottom nav), `mehrOnly` aliases are excluded.
 */
export function sideNavItems(opts: { isAdmin: boolean }): {
  main: NavItem[];
  system: NavItem[];
} {
  const visible = NAV_ITEMS.filter(
    item => !item.mehrOnly && (!item.adminOnly || opts.isAdmin),
  );
  return {
    main: visible.filter(i => i.section === 'main'),
    system: visible.filter(i => i.section === 'system'),
  };
}

/**
 * Items the mobile Mehr page renders. Skips items already prominent in
 * the bottom-nav so users don't see duplicates on small screens.
 */
export function mehrPageItems(opts: { isAdmin: boolean }): {
  main: NavItem[];
  system: NavItem[];
} {
  const visible = NAV_ITEMS.filter(
    item => !item.inBottomNav && (!item.adminOnly || opts.isAdmin),
  );
  return {
    main: visible.filter(i => i.section === 'main'),
    system: visible.filter(i => i.section === 'system'),
  };
}
