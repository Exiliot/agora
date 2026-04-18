import type { AttachmentSummary } from '@agora/shared';

export const uploadAttachment = async (file: File, comment?: string): Promise<AttachmentSummary> => {
  const form = new FormData();
  form.append('file', file, file.name);
  if (comment) form.append('comment', comment);
  const response = await fetch('/api/attachments', {
    method: 'POST',
    credentials: 'include',
    body: form,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`upload failed: ${response.status} ${text.slice(0, 200)}`);
  }
  return (await response.json()) as AttachmentSummary;
};
