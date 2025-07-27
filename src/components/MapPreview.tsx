interface MapPreviewProps {
  address: string;
}

export const MapPreview = ({ address }: MapPreviewProps) => {
  if (!address || address.length <= 3) {
    return null;
  }

  const encodedAddress = encodeURIComponent(address);
  const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${encodedAddress}&zoom=15&size=300x200&markers=color:red%7C${encodedAddress}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`;

  return (
    <div className="mt-4">
      <label className="text-sm font-medium">Location Preview</label>
      <div className="mt-2 border rounded-md overflow-hidden">
        <img 
          src={staticMapUrl} 
          alt="Location preview" 
          className="w-full h-[200px] object-cover"
          onError={(e) => {
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
          }}
        />
      </div>
    </div>
  );
};