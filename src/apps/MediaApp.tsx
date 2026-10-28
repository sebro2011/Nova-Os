import { useEffect, useRef, useState } from 'react';
import { FileAudio, Music2, Pause, Play, Plus, SkipBack, SkipForward, Trash2, Video, Volume2 } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';
import { createId, formatBytes } from '../lib/utils';

interface MediaItem {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

export default function MediaApp() {
  const [playlist, setPlaylist] = useState<MediaItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const mediaRef = useRef<HTMLVideoElement>(null);
  const playlistRef = useRef<MediaItem[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const { notify } = useNotifications();
  const selected = playlist.find((item) => item.id === selectedId);
  const isVideo = selected?.type.startsWith('video/');

  useEffect(() => { playlistRef.current = playlist; }, [playlist]);
  useEffect(() => () => playlistRef.current.forEach((item) => URL.revokeObjectURL(item.url)), []);

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const accepted: MediaItem[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('audio/') && !file.type.startsWith('video/')) {
        notify({ title: 'Unsupported media skipped', message: `${file.name} is not reported as an audio or video file.`, tone: 'warning' });
        continue;
      }
      if (file.size > 500 * 1024 * 1024) {
        notify({ title: 'Large media skipped', message: `${file.name} exceeds the 500 MB session limit for this lightweight player.`, tone: 'warning' });
        continue;
      }
      accepted.push({ id: createId('media'), name: file.name, url: URL.createObjectURL(file), type: file.type, size: file.size });
    }
    if (accepted.length) {
      setPlaylist((current) => [...current, ...accepted]);
      if (!selectedId) setSelectedId(accepted[0].id);
    }
  };

  const playPause = async () => {
    const media = mediaRef.current;
    if (!media || !selected) return;
    try {
      if (media.paused) await media.play();
      else media.pause();
    } catch {
      notify({ title: 'Playback could not start', message: 'The browser may not support this codec. Try a common MP3, MP4, OGG, or WebM file.', tone: 'warning' });
    }
  };

  const selectTrack = (id: string) => {
    setSelectedId(id);
    setCurrentTime(0);
    setDuration(0);
    setPlaying(false);
  };

  const skip = (offset: number) => {
    if (!playlist.length) return;
    const index = playlist.findIndex((item) => item.id === selectedId);
    selectTrack(playlist[(Math.max(0, index) + offset + playlist.length) % playlist.length].id);
  };

  const removeTrack = (id: string) => {
    const item = playlist.find((track) => track.id === id);
    if (!item) return;
    if (id === selectedId) mediaRef.current?.pause();
    URL.revokeObjectURL(item.url);
    const remaining = playlist.filter((track) => track.id !== id);
    setPlaylist(remaining);
    if (id === selectedId) setSelectedId(remaining[0]?.id ?? null);
  };

  return (
    <div className="flex h-full flex-col bg-[#080b15] lg:flex-row">
      <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[radial-gradient(ellipse_at_center,rgba(var(--accent-rgb),0.12),transparent_65%)]">
        <div className="relative flex min-h-48 flex-1 items-center justify-center overflow-hidden p-5">
          {selected ? isVideo ? <video
            ref={mediaRef}
            key={selected.id}
            src={selected.url}
            className="max-h-full max-w-full rounded-xl shadow-2xl"
            playsInline
            preload="metadata"
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
            onLoadedMetadata={(event) => { setDuration(event.currentTarget.duration); event.currentTarget.volume = volume; }}
            onEnded={() => skip(1)}
            onError={() => notify({ title: 'Media decoding error', message: 'This file or codec is not supported by your browser.', tone: 'error' })}
          /> : <div className="flex flex-col items-center text-center"><div className="relative flex h-32 w-32 items-center justify-center rounded-[32px] border border-white/10 bg-gradient-to-br from-nova-blue/20 to-nova-violet/15 shadow-glow"><Music2 size={52} strokeWidth={1.2} className="accent-text" /><span className={`absolute inset-0 rounded-[32px] border border-nova-blue/20 ${playing ? 'animate-ping' : ''}`} /></div><p className="mt-6 max-w-sm truncate text-sm font-medium text-white/75">{selected.name}</p><p className="mt-1.5 text-[10px] text-white/30">Local audio · session only</p><video ref={mediaRef} key={selected.id} src={selected.url} className="absolute h-px w-px opacity-0" preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)} onLoadedMetadata={(event) => { setDuration(event.currentTarget.duration); event.currentTarget.volume = volume; }} onEnded={() => skip(1)} onError={() => notify({ title: 'Media decoding error', message: 'This file or codec is not supported by your browser.', tone: 'error' })} /></div> : <div className="text-center"><span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03]"><FileAudio size={28} className="text-white/20" /></span><h2 className="mt-5 text-sm font-medium text-white/55">Your local listening station</h2><p className="mt-2 max-w-xs text-[11px] leading-5 text-white/30">Choose audio or video from your device. Files are played directly and never uploaded.</p><button className="nova-button mt-5" onClick={() => inputRef.current?.click()}><Plus size={15} /> Add local media</button></div>}
        </div>

        <div className="shrink-0 border-t border-white/[0.06] bg-black/20 p-4">
          <input type="range" className="range-accent block h-1 w-full cursor-pointer" min={0} max={duration || 0} step={0.1} value={Math.min(currentTime, duration || 0)} onChange={(event) => { const time = Number(event.target.value); if (mediaRef.current) mediaRef.current.currentTime = time; setCurrentTime(time); }} disabled={!selected} aria-label="Playback position" />
          <div className="mt-1.5 flex text-[9px] tabular-nums text-white/25"><span>{formatTime(currentTime)}</span><span className="ml-auto">{formatTime(duration)}</span></div>
          <div className="mt-2 flex items-center gap-2"><div className="hidden items-center gap-2 sm:flex"><Volume2 size={15} className="text-white/35" /><input type="range" className="range-accent w-20" min={0} max={1} step={0.05} value={volume} onChange={(event) => { const next = Number(event.target.value); setVolume(next); if (mediaRef.current) mediaRef.current.volume = next; }} aria-label="Volume" /></div><div className="flex flex-1 items-center justify-center gap-3"><button className="icon-button" onClick={() => skip(-1)} disabled={playlist.length < 2} aria-label="Previous media"><SkipBack size={18} /></button><button className="flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(var(--accent-rgb),0.3)] bg-[rgba(var(--accent-rgb),0.18)] text-white shadow-glow" onClick={() => void playPause()} disabled={!selected} aria-label={playing ? 'Pause' : 'Play'}>{playing ? <Pause size={19} /> : <Play size={19} className="ml-0.5" />}</button><button className="icon-button" onClick={() => skip(1)} disabled={playlist.length < 2} aria-label="Next media"><SkipForward size={18} /></button></div><span className="hidden w-24 text-right text-[9px] text-white/20 sm:block">{selected ? formatBytes(selected.size) : ''}</span></div>
        </div>
      </section>

      <aside className="flex max-h-56 w-full shrink-0 flex-col border-t border-white/[0.06] bg-black/15 lg:max-h-none lg:w-64 lg:border-l lg:border-t-0">
        <div className="flex items-center border-b border-white/[0.055] p-3"><div className="flex-1"><p className="eyebrow">SESSION QUEUE</p><p className="mt-1 text-[10px] text-white/25">{playlist.length} items</p></div><button className="icon-button" onClick={() => inputRef.current?.click()} aria-label="Add local media"><Plus size={16} /></button><input ref={inputRef} type="file" className="hidden" accept="audio/*,video/*" multiple onChange={(event) => { addFiles(event.target.files); event.target.value = ''; }} /></div>
        <div className="app-scroll min-h-0 flex-1 overflow-y-auto p-2">{playlist.map((item, index) => <div key={item.id} className={`group mb-1 flex items-center gap-2 rounded-lg p-2 ${selectedId === item.id ? 'bg-[rgba(var(--accent-rgb),0.1)]' : 'hover:bg-white/[0.03]'}`}><button className="flex min-w-0 flex-1 items-center gap-2.5 text-left" onClick={() => selectTrack(item.id)} onDoubleClick={() => { selectTrack(item.id); window.setTimeout(() => void playPause(), 50); }}><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-white/30">{item.type.startsWith('video/') ? <Video size={14} /> : <Music2 size={14} />}</span><span className="min-w-0"><span className="block truncate text-[11px] text-white/60">{index + 1}. {item.name}</span><span className="text-[9px] text-white/20">{formatBytes(item.size)}</span></span></button><button className="icon-button h-7 w-7 opacity-40 hover:!text-red-300 group-hover:opacity-100" onClick={() => removeTrack(item.id)} aria-label={`Remove ${item.name} from queue`}><Trash2 size={12} /></button></div>)}{!playlist.length && <p className="p-6 text-center text-[10px] leading-4 text-white/25">Your queue is empty.<br />Add media to begin.</p>}</div>
        <p className="border-t border-white/[0.05] p-3 text-[9px] leading-4 text-white/20">Session queue is not persisted. Browser codec support varies.</p>
      </aside>
    </div>
  );
}
