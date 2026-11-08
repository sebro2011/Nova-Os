export function DesktopWallpaper({ imageUrl }: { imageUrl?: string }) {
  return (
    <div className={`nova-wallpaper ${imageUrl ? 'has-custom' : ''}`} aria-hidden="true">
      {imageUrl && <img className="custom-wallpaper-image" src={imageUrl} alt="" draggable={false} />}
      {/* Decorative CSS-only neon layer; hidden unless the Neon glow preference is on. */}
      <div className="nova-wallpaper-neon" />
    </div>
  );
}
