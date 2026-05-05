import { describe, it, expect } from 'vitest';
import { MailTemplateType } from '@prisma/client';
import { DEFAULT_MAIL_TEMPLATES } from './default-mail-templates';

describe('DEFAULT_MAIL_TEMPLATES', () => {
  it('contains an entry for every MailTemplateType', () => {
    const types = DEFAULT_MAIL_TEMPLATES.map(t => t.templateType);
    const expected: MailTemplateType[] = [
      MailTemplateType.INVITE,
      MailTemplateType.REMINDER,
      MailTemplateType.CUSTOM,
      MailTemplateType.EMAIL_VERIFY,
      MailTemplateType.PASSWORD_RESET,
      MailTemplateType.TOTP_ENABLE,
      MailTemplateType.TOTP_DISABLE,
      MailTemplateType.API_KEY_CREATED,
    ];
    expect(types).toEqual(expect.arrayContaining(expected));
    expect(types).toHaveLength(expected.length);
  });

  it('every template has non-empty name, subject and body', () => {
    for (const tpl of DEFAULT_MAIL_TEMPLATES) {
      expect(tpl.name.trim(), `name leer bei ${tpl.templateType}`).not.toBe('');
      expect(tpl.subject.trim(), `subject leer bei ${tpl.templateType}`).not.toBe('');
      expect(tpl.body.trim(), `body leer bei ${tpl.templateType}`).not.toBe('');
    }
  });

  it('every template body is valid HTML (starts with <!DOCTYPE html>)', () => {
    for (const tpl of DEFAULT_MAIL_TEMPLATES) {
      expect(tpl.body.trimStart(), `body kein HTML bei ${tpl.templateType}`).toMatch(/^<!DOCTYPE html>/i);
    }
  });

  it('INVITE template body contains {{inviteUrl}} placeholder', () => {
    const invite = DEFAULT_MAIL_TEMPLATES.find(t => t.templateType === MailTemplateType.INVITE)!;
    expect(invite.body).toContain('{{inviteUrl}}');
  });

  it('EMAIL_VERIFY template body contains {{verifyUrl}} placeholder', () => {
    const tpl = DEFAULT_MAIL_TEMPLATES.find(t => t.templateType === MailTemplateType.EMAIL_VERIFY)!;
    expect(tpl.body).toContain('{{verifyUrl}}');
  });

  it('PASSWORD_RESET template body contains {{resetUrl}} placeholder', () => {
    const tpl = DEFAULT_MAIL_TEMPLATES.find(t => t.templateType === MailTemplateType.PASSWORD_RESET)!;
    expect(tpl.body).toContain('{{resetUrl}}');
  });

  it('no duplicate templateTypes', () => {
    const types = DEFAULT_MAIL_TEMPLATES.map(t => t.templateType);
    const unique = new Set(types);
    expect(unique.size).toBe(types.length);
  });
});
