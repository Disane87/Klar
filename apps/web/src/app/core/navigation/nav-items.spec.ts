import { describe, it, expect } from 'vitest';
import { NAV_ITEMS, sideNavItems, mehrPageItems } from './nav-items';

describe('nav-items registry', () => {
  it('every item has a non-empty id, label, route, icon, tone, section', () => {
    for (const item of NAV_ITEMS) {
      expect(item.id).toBeTruthy();
      expect(item.label).toBeTruthy();
      expect(item.route).toMatch(/^\/app\//);
      expect(item.icon).toBeTruthy();
      expect(item.tone).toMatch(/^var\(--/);
      expect(['main', 'system']).toContain(item.section);
    }
  });

  it('item ids are unique', () => {
    const ids = NAV_ITEMS.map(i => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('sideNavItems', () => {
  it('omits admin entries when not admin', () => {
    const groups = sideNavItems({ isAdmin: false });
    const all = [...groups.main, ...groups.system];
    expect(all.find(i => i.id === 'admin')).toBeUndefined();
  });

  it('includes admin in system when admin', () => {
    const groups = sideNavItems({ isAdmin: true });
    expect(groups.system.find(i => i.id === 'admin')).toBeDefined();
  });

  it('omits mehr-only aliases (e.g. Daueraufträge → /app/buchungen)', () => {
    const groups = sideNavItems({ isAdmin: true });
    const all = [...groups.main, ...groups.system];
    expect(all.find(i => i.id === 'recurring')).toBeUndefined();
  });

  it('includes the Banken entry under main', () => {
    const groups = sideNavItems({ isAdmin: false });
    expect(groups.main.find(i => i.id === 'banken')?.route).toBe('/app/banken');
  });
});

describe('mehrPageItems', () => {
  it('omits items already shown in the bottom-nav', () => {
    const groups = mehrPageItems({ isAdmin: true });
    const all = [...groups.main, ...groups.system];
    for (const id of ['fixkosten', 'monat', 'projekte']) {
      expect(all.find(i => i.id === id)).toBeUndefined();
    }
  });

  it('includes mehr-only aliases', () => {
    const groups = mehrPageItems({ isAdmin: false });
    expect(groups.main.find(i => i.id === 'recurring')).toBeDefined();
  });

  it('omits admin entries when not admin', () => {
    const groups = mehrPageItems({ isAdmin: false });
    const all = [...groups.main, ...groups.system];
    expect(all.find(i => i.id === 'admin')).toBeUndefined();
  });

  it('includes the Banken entry', () => {
    const groups = mehrPageItems({ isAdmin: false });
    expect(groups.main.find(i => i.id === 'banken')?.route).toBe('/app/banken');
  });
});
