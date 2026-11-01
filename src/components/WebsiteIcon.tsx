import type { WebsiteShortcut } from '../types';

export function WebsiteIcon({ website, size = 20 }: { website: Pick<WebsiteShortcut, 'name' | 'icon'>; size?: number }) {
  if (website.icon) {
    return <img src={website.icon} alt="" width={size} height={size} className="shrink-0 rounded-[22%] object-contain" draggable={false} />;
  }
  return <span aria-hidden="true" className="select-none font-semibold leading-none" style={{ fontSize: Math.max(11, size * 0.68) }}>{website.name.trim().charAt(0).toUpperCase() || 'W'}</span>;
}
