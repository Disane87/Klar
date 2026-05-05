import { MailTemplateType } from '@prisma/client';

export interface DefaultMailTemplate {
  templateType: MailTemplateType;
  name: string;
  subject: string;
  body: string;
}

const CARD = `background-color:#18181b;border-radius:12px;border:1px solid #27272a;padding:40px 40px 36px`;
const PAGE = `margin:0;padding:0;background-color:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`;
const LOGO = `<span style="font-size:28px;font-weight:700;letter-spacing:-0.5px;color:#f4f4f5;">Klar</span>`;
const BTN  = (href: string, label: string) =>
  `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:32px 0 24px;"><tr><td style="border-radius:8px;background-color:#38bdf8;"><a href="${href}" target="_blank" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#0c1a28;text-decoration:none;border-radius:8px;">${label}</a></td></tr></table>`;

function page(inner: string): string {
  return `<!DOCTYPE html>
<html lang="de">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="${PAGE}">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="${PAGE}">
  <tr><td align="center" style="padding:48px 16px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;">
      <tr><td align="center" style="padding-bottom:40px;">${LOGO}</td></tr>
      <tr><td style="${CARD}">${inner}</td></tr>
      <tr><td style="padding-top:28px;" align="center">
        <p style="margin:0;font-size:11px;color:#3f3f46;text-align:center;">
          &copy; {{year}} Klar &mdash; Alle Rechte vorbehalten
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function greeting(extra = ''): string {
  return `<p style="margin:0 0 8px;font-size:22px;font-weight:600;color:#f4f4f5;line-height:1.3;">Hallo {{displayName}},</p>${extra}`;
}

function note(text: string): string {
  return `<p style="margin:24px 0 0;font-size:13px;color:#71717a;line-height:1.5;">${text}</p>`;
}

function ignoreNote(reason: string): string {
  return `<hr style="margin:28px 0;border:none;border-top:1px solid #27272a;" /><p style="margin:0;font-size:12px;color:#52525b;line-height:1.6;">${reason}</p>`;
}

export const DEFAULT_MAIL_TEMPLATES: DefaultMailTemplate[] = [
  {
    templateType: MailTemplateType.INVITE,
    name:    'Einladung',
    subject: 'Einladung zu {{householdName}} — Klar',
    body: page(
      greeting(`
        <p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#a1a1aa;">
          <strong style="color:#f4f4f5;">{{inviterName}}</strong> lädt dich ein, dem Haushalt
          <strong style="color:#f4f4f5;">{{householdName}}</strong> beizutreten.
        </p>
        ${BTN('{{inviteUrl}}', 'Einladung annehmen')}
        <p style="margin:0;font-size:13px;color:#71717a;">
          Einladungscode: <code style="color:#a1a1aa;background:#27272a;padding:2px 6px;border-radius:4px;">{{inviteCode}}</code>
        </p>
        ${ignoreNote('Falls du keine Einladung erwartet hast, kannst du diese E-Mail ignorieren.')}
      `),
    ),
  },

  {
    templateType: MailTemplateType.REMINDER,
    name:    'Erinnerung',
    subject: 'Erinnerung: {{householdName}} — Klar',
    body: page(
      greeting(`
        <p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#a1a1aa;">
          Vergiss nicht, deine Fixkosten zu aktualisieren!
        </p>
        ${note('Melde dich bei <strong style="color:#f4f4f5;">Klar</strong> an und überprüfe deine monatlichen Ausgaben.')}
      `),
    ),
  },

  {
    templateType: MailTemplateType.CUSTOM,
    name:    'Benutzerdefiniert',
    subject: 'Nachricht von {{householdName}} — Klar',
    body: page(
      greeting(`
        <p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#a1a1aa;">
          {{message}}
        </p>
      `),
    ),
  },

  {
    templateType: MailTemplateType.EMAIL_VERIFY,
    name:    'E-Mail bestätigen',
    subject: 'Bitte bestätige deine E-Mail-Adresse — Klar',
    body: page(
      greeting(`
        <p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#a1a1aa;">
          Bitte bestätige deine E-Mail-Adresse, um dein Klar-Konto zu aktivieren.
        </p>
        ${BTN('{{verifyUrl}}', 'E-Mail-Adresse bestätigen')}
        ${note('Dieser Link ist <strong style="color:#a1a1aa;">24 Stunden</strong> gültig.')}
        ${ignoreNote('Falls du dich nicht bei Klar registriert hast, kannst du diese E-Mail ignorieren.')}
        <p style="margin:8px 0 0;font-size:12px;color:#52525b;line-height:1.6;word-break:break-all;">
          Alternativ: <a href="{{verifyUrl}}" style="color:#38bdf8;text-decoration:none;">{{verifyUrl}}</a>
        </p>
      `),
    ),
  },

  {
    templateType: MailTemplateType.PASSWORD_RESET,
    name:    'Passwort zurücksetzen',
    subject: 'Passwort zurücksetzen — Klar',
    body: page(
      greeting(`
        <p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#a1a1aa;">
          Du hast angefordert, dein Passwort zurückzusetzen.
        </p>
        ${BTN('{{resetUrl}}', 'Passwort zurücksetzen')}
        ${note('Dieser Link ist <strong style="color:#a1a1aa;">1 Stunde</strong> gültig. Solange du ihn nicht nutzt, bleibt dein Passwort unverändert.')}
        ${ignoreNote('Falls du das nicht angefordert hast, kannst du diese E-Mail ignorieren.')}
      `),
    ),
  },

  {
    templateType: MailTemplateType.TOTP_ENABLE,
    name:    '2FA aktiviert',
    subject: '2-Faktor-Authentifizierung aktiviert — Klar',
    body: page(
      greeting(`
        <p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#a1a1aa;">
          Die 2-Faktor-Authentifizierung wurde für dein Konto erfolgreich aktiviert.
        </p>
        <div style="margin:24px 0;padding:16px;background:#27272a;border-radius:8px;">
          <p style="margin:0;font-size:14px;color:#a1a1aa;line-height:1.6;">
            <strong style="color:#f4f4f5;">Konto:</strong> {{email}}<br />
            <strong style="color:#f4f4f5;">Aktiviert am:</strong> {{date}}
          </p>
        </div>
        ${note('Falls du diese Änderung nicht vorgenommen hast, wende dich bitte sofort an den Support.')}
      `),
    ),
  },

  {
    templateType: MailTemplateType.TOTP_DISABLE,
    name:    '2FA deaktiviert',
    subject: '2-Faktor-Authentifizierung deaktiviert — Klar',
    body: page(
      greeting(`
        <p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#a1a1aa;">
          Die 2-Faktor-Authentifizierung wurde für dein Konto deaktiviert.
        </p>
        <div style="margin:24px 0;padding:16px;background:#27272a;border-radius:8px;">
          <p style="margin:0;font-size:14px;color:#a1a1aa;line-height:1.6;">
            <strong style="color:#f4f4f5;">Konto:</strong> {{email}}<br />
            <strong style="color:#f4f4f5;">Deaktiviert am:</strong> {{date}}
          </p>
        </div>
        ${note('Wir empfehlen, 2FA aktiviert zu lassen, um dein Konto zu schützen.')}
        ${ignoreNote('Falls du diese Änderung nicht vorgenommen hast, ändere sofort dein Passwort.')}
      `),
    ),
  },

  {
    templateType: MailTemplateType.API_KEY_CREATED,
    name:    'API-Key erstellt',
    subject: 'Neuer API-Key erstellt — Klar',
    body: page(
      greeting(`
        <p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#a1a1aa;">
          Ein neuer API-Key wurde für deinen Account erstellt.
        </p>
        <div style="margin:24px 0;padding:16px;background:#27272a;border-radius:8px;">
          <p style="margin:0;font-size:14px;color:#a1a1aa;line-height:1.6;">
            <strong style="color:#f4f4f5;">Name:</strong> {{keyName}}<br />
            <strong style="color:#f4f4f5;">Erstellt am:</strong> {{createdAt}}<br />
            <strong style="color:#f4f4f5;">Prefix:</strong> <code style="color:#a1a1aa;">{{keyPrefix}}</code>
          </p>
        </div>
        ${note('Der Schlüssel wurde dir einmalig angezeigt und wird nicht erneut ausgegeben. Bewahre ihn sicher auf.')}
        ${ignoreNote('Falls du diesen Key nicht erstellt hast, widerrufe ihn sofort in deinen Kontoeinstellungen.')}
      `),
    ),
  },
];
