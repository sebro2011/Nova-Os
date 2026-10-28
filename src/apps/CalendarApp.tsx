import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Plus, Trash2, X } from 'lucide-react';
import { AppError, AppLoading } from '../components/AppStates';
import { useNotifications } from '../context/NotificationContext';
import { deleteRecord, getAllRecords, initializeDatabase, putRecord } from '../lib/db';
import { getCalendarDays } from '../lib/calendar';
import { createId, errorMessage, toLocalDateKey } from '../lib/utils';
import type { CalendarEvent } from '../types';

export default function CalendarApp() {
  const today = useMemo(() => new Date(), []);
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(toLocalDateKey(today));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { notify } = useNotifications();

  const load = useCallback(async () => {
    setError('');
    try {
      await initializeDatabase();
      const records = await getAllRecords<CalendarEvent>('events');
      setEvents(records.sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener('nova:data-imported', refresh);
    return () => window.removeEventListener('nova:data-imported', refresh);
  }, [load]);

  const days = useMemo(() => getCalendarDays(month), [month]);
  const selectedEvents = events.filter((event) => event.date === selectedDate).sort((a, b) => a.time.localeCompare(b.time));
  const todayKey = toLocalDateKey(today);

  const changeMonth = (offset: number) => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  const newEvent = () => setEditing({ id: '', title: '', date: selectedDate, time: '', details: '', createdAt: '' });

  const saveEvent = async () => {
    if (!editing) return;
    try {
      if (!editing.title.trim()) throw new Error('Give your event a title.');
      const now = new Date().toISOString();
      const event: CalendarEvent = { ...editing, id: editing.id || createId('event'), title: editing.title.trim().slice(0, 160), details: editing.details.slice(0, 4_000), createdAt: editing.createdAt || now };
      await putRecord('events', event);
      setEvents((current) => [...current.filter((item) => item.id !== event.id), event]);
      setSelectedDate(event.date);
      setEditing(null);
      notify({ title: 'Event saved locally', message: `${event.title} · ${event.date}`, tone: 'success' });
    } catch (caught) {
      notify({ title: 'Event not saved', message: errorMessage(caught), tone: 'warning' });
    }
  };

  const removeEvent = async (event: CalendarEvent) => {
    if (!window.confirm(`Delete “${event.title}”?`)) return;
    try {
      await deleteRecord('events', event.id);
      setEvents((current) => current.filter((item) => item.id !== event.id));
    } catch (caught) {
      notify({ title: 'Event not deleted', message: errorMessage(caught), tone: 'error' });
    }
  };

  if (loading) return <AppLoading label="Opening your local calendar…" />;
  if (error && !events.length) return <AppError message={error} onRetry={() => { setLoading(true); void load(); }} />;

  return (
    <div className="app-scroll relative h-full overflow-auto bg-black/5">
      <div className="flex min-h-14 flex-wrap items-center gap-2 border-b border-ink/[0.06] px-3 py-2.5 sm:px-4">
        <button className="icon-button" onClick={() => changeMonth(-1)} aria-label="Previous month"><ChevronLeft size={17} /></button>
        <h2 className="min-w-36 text-center text-sm font-semibold capitalize text-ink/80">{new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(month)}</h2>
        <button className="icon-button" onClick={() => changeMonth(1)} aria-label="Next month"><ChevronRight size={17} /></button>
        <button className="nova-button nova-button-secondary ml-1 h-8 min-h-8 px-2.5 text-[10px]" onClick={() => { setMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDate(todayKey); }}>Today</button>
        <button className="nova-button ml-auto h-9 min-h-9 px-3 text-[11px]" onClick={newEvent}><Plus size={14} /> Event</button>
      </div>

      <div className="grid min-h-[430px] lg:grid-cols-[minmax(0,1fr)_240px]">
        <section className="p-2.5 sm:p-4" aria-label="Month calendar">
          <div className="grid grid-cols-7">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <div key={day} className="py-2 text-center text-[9px] font-semibold uppercase tracking-wider text-ink/25">{day}</div>)}</div>
          <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-ink/[0.06]">
            {days.map((day) => {
              const dayEvents = events.filter((event) => event.date === day.key);
              const selected = day.key === selectedDate;
              return <button key={day.key} className={`relative min-h-14 border-b border-r border-ink/[0.045] p-1.5 text-left align-top transition-colors last:border-r-0 sm:min-h-[74px] sm:p-2 ${selected ? 'bg-[rgba(var(--accent-rgb),0.1)]' : 'hover:bg-ink/[0.025]'} ${day.inCurrentMonth ? '' : 'bg-black/10'}`} onClick={() => { setSelectedDate(day.key); if (!day.inCurrentMonth) setMonth(new Date(day.date.getFullYear(), day.date.getMonth(), 1)); }} aria-label={`${day.date.toDateString()}, ${dayEvents.length} events`} aria-pressed={selected}>
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] ${day.key === todayKey ? 'bg-[rgba(var(--accent-rgb),0.25)] font-semibold text-ink' : day.inCurrentMonth ? 'text-ink/60' : 'text-ink/20'}`}>{day.date.getDate()}</span>
                <div className="mt-1 space-y-1">{dayEvents.slice(0, 2).map((event) => <span key={event.id} className="hidden truncate rounded bg-[rgba(var(--accent-rgb),0.12)] px-1 py-0.5 text-[8px] text-ink/50 sm:block">{event.time && `${event.time} `}{event.title}</span>)}{dayEvents.length > 0 && <span className="flex gap-0.5 sm:hidden">{dayEvents.slice(0, 3).map((event) => <span key={event.id} className="h-1 w-1 rounded-full bg-nova-blue" />)}</span>}</div>
              </button>;
            })}
          </div>
        </section>

        <aside className="border-t border-ink/[0.06] bg-black/10 p-4 lg:border-l lg:border-t-0">
          <p className="eyebrow">DAY BRIEFING</p>
          <h3 className="mt-2 text-sm font-semibold text-ink/75">{new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(`${selectedDate}T12:00:00`))}</h3>
          <div className="mt-4 space-y-2">{selectedEvents.map((event) => <button key={event.id} className="nova-card w-full p-3 text-left hover:bg-ink/[0.05]" onClick={() => setEditing(event)}><span className="block text-xs font-medium text-ink/75">{event.title}</span><span className="mt-1.5 flex items-center gap-1.5 text-[10px] text-ink/30"><Clock3 size={11} />{event.time || 'All day'}</span>{event.details && <span className="mt-2 line-clamp-2 text-[10px] leading-4 text-ink/30">{event.details}</span>}</button>)}{!selectedEvents.length && <div className="rounded-xl border border-dashed border-ink/[0.07] px-4 py-8 text-center"><CalendarDays size={22} className="mx-auto text-ink/12" /><p className="mt-3 text-[11px] text-ink/30">No events scheduled.</p></div>}</div>
          <button className="nova-button nova-button-secondary mt-3 w-full text-[11px]" onClick={newEvent}><Plus size={13} /> Add on this day</button>
          <p className="mt-4 text-[9px] leading-4 text-ink/20">Events stay in this browser. No account or remote calendar sync.</p>
        </aside>
      </div>

      {editing && <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50 p-4" onClick={() => setEditing(null)}><form className="glass-panel max-h-full w-full max-w-md overflow-y-auto p-5 app-scroll" onClick={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); void saveEvent(); }}><div className="flex items-center"><div className="flex-1"><p className="eyebrow">LOCAL EVENT</p><h3 className="mt-1 text-base font-semibold">{editing.id ? 'Edit event' : 'New event'}</h3></div><button type="button" className="icon-button" onClick={() => setEditing(null)} aria-label="Close event editor"><X size={16} /></button></div><label className="mt-5 block text-[11px] text-ink/45">Title<input className="nova-input mt-1.5" value={editing.title} onChange={(event) => setEditing({ ...editing, title: event.target.value })} maxLength={160} required autoFocus placeholder="What’s happening?" /></label><div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2"><label className="text-[11px] text-ink/45">Date<input type="date" className="nova-input mt-1.5" value={editing.date} onChange={(event) => setEditing({ ...editing, date: event.target.value })} required /></label><label className="text-[11px] text-ink/45">Time<input type="time" className="nova-input mt-1.5" value={editing.time} onChange={(event) => setEditing({ ...editing, time: event.target.value })} /></label></div><label className="mt-3 block text-[11px] text-ink/45">Details<textarea className="nova-input mt-1.5 h-24" value={editing.details} onChange={(event) => setEditing({ ...editing, details: event.target.value })} maxLength={4000} placeholder="Optional notes" /></label><div className="mt-5 flex flex-wrap items-center gap-2">{editing.id && <button type="button" className="nova-button nova-button-danger mr-auto" onClick={() => { const item = editing; setEditing(null); void removeEvent(item); }}><Trash2 size={14} /> Delete</button>}<button type="button" className="nova-button nova-button-secondary ml-auto" onClick={() => setEditing(null)}>Cancel</button><button type="submit" className="nova-button">Save event</button></div></form></div>}
    </div>
  );
}
