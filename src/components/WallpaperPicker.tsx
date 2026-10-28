import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ImagePlus, Trash2, Upload } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { usePreferences } from '../context/PreferencesContext';
import { deleteRecord, getAllRecords, initializeDatabase, putRecord } from '../lib/db';
import { createId, errorMessage, formatBytes } from '../lib/utils';
import type { WallpaperRecord } from '../types';

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_WALLPAPER_SIZE = 10 * 1024 * 1024;

function CustomWallpaperCard({ wallpaper, active, onSelect, onDelete }: {
  wallpaper: WallpaperRecord;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const [url, setUrl] = useState('');

  useEffect(() => {
    const objectUrl = URL.createObjectURL(wallpaper.blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [wallpaper]);

  return (
    <article className={`relative overflow-hidden rounded-xl border ${active ? 'border-[rgba(var(--accent-rgb),0.5)]' : 'border-ink/[0.08]'}`}>
      <button className="group block w-full text-left" onClick={onSelect} aria-pressed={active} aria-label={`Use wallpaper ${wallpaper.name}`}>
        {url && <img src={url} alt="" className="h-24 w-full object-cover transition-transform group-hover:scale-[1.02]" />}
        <span className="flex items-center gap-2 bg-ink/[0.04] px-2.5 py-2">
          <span className="min-w-0 flex-1 truncate text-[10px] text-ink/60">{wallpaper.name}</span>
          {active && <Check size={12} className="accent-text shrink-0" />}
        </span>
      </button>
      <button className="icon-button absolute right-1.5 top-1.5 h-7 w-7 bg-black/45 !text-white hover:!bg-red-500/60" onClick={onDelete} aria-label={`Delete wallpaper ${wallpaper.name}`} title="Delete custom wallpaper"><Trash2 size={12} /></button>
      <span className="absolute left-2 top-2 rounded bg-black/45 px-1.5 py-0.5 text-[8px] text-white/70">{formatBytes(wallpaper.size)}</span>
    </article>
  );
}

export function WallpaperPicker() {
  const [wallpapers, setWallpapers] = useState<WallpaperRecord[]>([]);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { preferences, updatePreferences } = usePreferences();
  const { notify } = useNotifications();

  const loadWallpapers = useCallback(async () => {
    try {
      await initializeDatabase();
      const records = await getAllRecords<WallpaperRecord>('wallpapers');
      setWallpapers(records.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    } catch (error) {
      notify({ title: 'Custom wallpapers unavailable', message: errorMessage(error), tone: 'warning' });
    }
  }, [notify]);

  useEffect(() => { void loadWallpapers(); }, [loadWallpapers]);

  const uploadWallpaper = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    let bitmap: ImageBitmap | undefined;
    try {
      if (!ACCEPTED_TYPES.includes(file.type)) throw new Error('Choose a PNG, JPEG, or WebP image. SVG and animated GIF files are not accepted.');
      if (file.size > MAX_WALLPAPER_SIZE) throw new Error('Wallpapers are limited to 10 MB.');
      bitmap = await createImageBitmap(file);
      if (bitmap.width * bitmap.height > 40_000_000) throw new Error('Image dimensions are too large. Choose an image under 40 megapixels.');
      const record: WallpaperRecord = {
        id: createId('wallpaper'),
        name: file.name.slice(0, 160) || 'Custom wallpaper',
        type: file.type,
        size: file.size,
        blob: file,
        createdAt: new Date().toISOString(),
      };
      await putRecord('wallpapers', record);
      setWallpapers((current) => [record, ...current]);
      updatePreferences({ wallpaper: 'custom', customWallpaperId: record.id });
      notify({ title: 'Desktop wallpaper applied', message: `${record.name} is stored locally in this browser.`, tone: 'success' });
    } catch (error) {
      notify({ title: 'Wallpaper not added', message: errorMessage(error), tone: 'warning' });
    } finally {
      bitmap?.close();
      setUploading(false);
    }
  };

  const removeWallpaper = async (wallpaper: WallpaperRecord) => {
    if (!window.confirm(`Delete custom wallpaper “${wallpaper.name}” from this browser?`)) return;
    try {
      await deleteRecord('wallpapers', wallpaper.id);
      setWallpapers((current) => current.filter((item) => item.id !== wallpaper.id));
      if (preferences.customWallpaperId === wallpaper.id) {
        updatePreferences({ wallpaper: 'aurora', customWallpaperId: null });
      }
    } catch (error) {
      notify({ title: 'Wallpaper not deleted', message: errorMessage(error), tone: 'error' });
    }
  };

  return (
    <section className="mt-5">
      <div className="flex items-center gap-3">
        <h3 className="flex-1 text-xs font-medium text-ink/60">Desktop wallpaper</h3>
        <button className="nova-button nova-button-secondary h-8 min-h-8 px-2.5 text-[10px]" onClick={() => inputRef.current?.click()} disabled={uploading}>
          <ImagePlus size={13} /> {uploading ? 'Adding…' : 'Upload image'}
        </button>
        <input ref={inputRef} type="file" className="hidden" accept="image/png,image/jpeg,image/webp" onChange={(event) => { void uploadWallpaper(event.target.files?.[0]); event.target.value = ''; }} />
      </div>
      <div className="mt-2.5 grid grid-cols-3 gap-2">
        {(['aurora', 'orbit', 'starlight'] as const).map((wallpaper) => (
          <button key={wallpaper} className={`rounded-xl border px-3 py-3 text-[10px] capitalize ${preferences.wallpaper === wallpaper ? 'border-[rgba(var(--accent-rgb),0.35)] accent-text bg-[rgba(var(--accent-rgb),0.07)]' : 'border-ink/[0.06] text-ink/35'}`} onClick={() => updatePreferences({ wallpaper })} aria-pressed={preferences.wallpaper === wallpaper}>{wallpaper}</button>
        ))}
      </div>
      {wallpapers.length > 0 && <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3">{wallpapers.map((wallpaper) => (
        <CustomWallpaperCard
          key={wallpaper.id}
          wallpaper={wallpaper}
          active={preferences.wallpaper === 'custom' && preferences.customWallpaperId === wallpaper.id}
          onSelect={() => updatePreferences({ wallpaper: 'custom', customWallpaperId: wallpaper.id })}
          onDelete={() => void removeWallpaper(wallpaper)}
        />
      ))}</div>}
      {wallpapers.length === 0 && <button className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-ink/10 px-4 py-5 text-[10px] text-ink/30 transition-colors hover:bg-ink/[0.03]" onClick={() => inputRef.current?.click()}><Upload size={14} /> Choose your own desktop image</button>}
      <p className="mt-2.5 text-[9px] leading-4 text-ink/25">PNG, JPEG, or WebP · 10 MB maximum · stored in IndexedDB. Custom images are not included in JSON backups.</p>
    </section>
  );
}
