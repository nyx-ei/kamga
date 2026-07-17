/* eslint-disable simple-import-sort/imports -- CV-FS-06 requires server-only to be the first import. */
import 'server-only';

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function emailShell(content: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#fff8dc;font-family:Arial,Helvetica,sans-serif;color:#08112a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff8dc;margin:0;padding:24px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #d8dfec;border-radius:6px;">
            <tr>
              <td style="padding:32px;">
                ${content}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function primaryLink(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;background:#84a2ff;color:#08112a;text-decoration:none;font-weight:700;border-radius:4px;padding:12px 16px;">${escapeHtml(label)}</a>`;
}
