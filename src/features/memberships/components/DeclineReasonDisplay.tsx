/* eslint-disable simple-import-sort/imports -- CV-FS-06 requires server-only to be the first import. */
import 'server-only';

import sanitizeHtml from 'sanitize-html';

type DeclineReasonDisplayProps = {
  html: string;
};

export function DeclineReasonDisplay({ html }: DeclineReasonDisplayProps) {
  const sanitizedHtml = sanitizeHtml(html, {
    allowedAttributes: {
      a: ['href', 'rel', 'target']
    },
    allowedTags: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'a']
  });

  return (
    <div
      className="rounded-sm border border-border bg-sunken p-4 text-sm leading-6 text-body [&_a]:text-link [&_a]:underline [&_ol]:ml-5 [&_ol]:list-decimal [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:ml-5 [&_ul]:list-disc"
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
}
