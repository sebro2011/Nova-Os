/**
 * Plays a short locally generated chime. Call only from a user gesture: browsers may
 * reject autoplay otherwise. No audio asset, network request, or persistent context is used.
 */
export async function playStartupSound(): Promise<boolean> {
  if (typeof AudioContext !== 'function') return false;
  const context = new AudioContext();
  try {
    await context.resume();
    const master = context.createGain();
    master.gain.setValueAtTime(0.0001, context.currentTime);
    master.gain.exponentialRampToValueAtTime(0.075, context.currentTime + 0.035);
    master.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.52);
    master.connect(context.destination);

    const first = context.createOscillator();
    first.type = 'sine';
    first.frequency.setValueAtTime(440, context.currentTime);
    first.frequency.exponentialRampToValueAtTime(660, context.currentTime + 0.24);
    first.connect(master);

    const second = context.createOscillator();
    second.type = 'sine';
    second.frequency.setValueAtTime(880, context.currentTime + 0.12);
    second.connect(master);

    const completed = new Promise<void>((resolve) => { second.onended = () => resolve(); });
    first.start();
    second.start(context.currentTime + 0.12);
    first.stop(context.currentTime + 0.34);
    second.stop(context.currentTime + 0.54);
    await completed;
    return true;
  } catch {
    return false;
  } finally {
    void context.close().catch(() => undefined);
  }
}
