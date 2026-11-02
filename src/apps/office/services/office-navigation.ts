import type { AppId } from '../../../types';
import { OFFICE_MIME } from '../core/file-formats/constants';

export function officeAppForMime(mimeType: string | undefined): AppId | null {
  if (mimeType === OFFICE_MIME.writer) return 'writer';
  if (mimeType === OFFICE_MIME.sheets) return 'sheets';
  return null;
}
