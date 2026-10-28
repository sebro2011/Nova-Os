export function DesktopWallpaper({ imageUrl }: { imageUrl?: string }) {
  return (
    <div className={`nova-wallpaper ${imageUrl ? 'has-custom' : ''}`} aria-hidden="true">
      {imageUrl && <img className="custom-wallpaper-image" src={imageUrl} alt="" draggable={false} />}
    </div>
  );
}
