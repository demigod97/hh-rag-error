import { useState, useCallback } from "react";
import { GoogleMap, useJsApiLoader, Marker } from "@react-google-maps/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MapPin, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ComponentErrorBoundary } from "@/components/ErrorBoundary";
import { useErrorHandler } from "@/hooks/useErrorHandler";

const libraries: ("places")[] = ["places"];

interface MapTabProps {
  sessionId: string;
}

interface SelectedPlace {
  placeId: string;
  address: string;
  lat: number;
  lng: number;
}

export const MapTab = ({ sessionId }: MapTabProps) => {
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null);
  const [address, setAddress] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string>("");
  const { handleAsyncError } = useErrorHandler();

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "", 
    libraries,
  });

  const handlePlaceSelect = useCallback(async (place: google.maps.places.PlaceResult) => {
    if (!place.place_id || !place.geometry?.location) return;

    const selectedPlace: SelectedPlace = {
      placeId: place.place_id,
      address: place.formatted_address || "",
      lat: place.geometry.location.lat(),
      lng: place.geometry.location.lng(),
    };

    setSelectedPlace(selectedPlace);
    setAddress(selectedPlace.address);

    try {
      await handleAsyncError(async () => {
        const response = await fetch("/api/chat/location", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId,
            placeId: selectedPlace.placeId,
            geojson: {
              type: "Point",
              coordinates: [selectedPlace.lng, selectedPlace.lat],
            },
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to save location');
        }
      }, { operation: 'save_location', sessionId });
      
      toast("Location saved successfully");
    } catch (error) {
      console.error("Failed to save location:", error);
      toast("Failed to save location");
    }
  }, [sessionId, handleAsyncError]);

  const handleAddressSearch = async () => {
    if (!address.trim()) return;
    
    setIsSearching(true);
    setSearchError("");
    
    try {
      // Simple geocoding simulation - in production, use Google Places API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock coordinates for demonstration
      const mockPlace: SelectedPlace = {
        placeId: `mock-${Date.now()}`,
        address: address,
        lat: -33.8688 + (Math.random() - 0.5) * 0.1,
        lng: 151.2093 + (Math.random() - 0.5) * 0.1,
      };
      
      setSelectedPlace(mockPlace);
      toast("Location found and mapped");
    } catch (error) {
      setSearchError("Failed to find location. Please try a different address.");
    } finally {
      setIsSearching(false);
    }
  };

  const mapOptions = {
    disableDefaultUI: true,
    zoomControl: true,
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: false,
  };

  if (loadError) {
    return (
      <div className="text-center py-8 px-4">
        <MapPin className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
        <p className="text-sm text-destructive mb-2">Failed to load Google Maps</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Please check your Google Maps API key configuration
        </p>
      </div>
    );
  }

  return (
    <ComponentErrorBoundary>
      <div className="space-y-4 p-4">
        <div>
          <h3 className="text-sm font-medium text-foreground mb-3">
            Location & Mapping
          </h3>
          
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="address" className="text-sm font-medium text-foreground">
                Property Address
              </Label>
              <div className="flex gap-2">
                <Input
                  id="address"
                  placeholder="Enter address to search"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="flex-1 bg-background"
                  onKeyPress={(e) => e.key === 'Enter' && handleAddressSearch()}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAddressSearch}
                  disabled={isSearching || !address.trim()}
                  className="px-3"
                >
                  {isSearching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>
              
              {searchError && (
                <p className="text-xs text-destructive">{searchError}</p>
              )}
            </div>

            <div className="border rounded-lg overflow-hidden">
              {isLoaded && selectedPlace ? (
                <GoogleMap
                  mapContainerStyle={{ width: "100%", height: "200px" }}
                  center={{ lat: selectedPlace.lat, lng: selectedPlace.lng }}
                  zoom={16}
                  options={mapOptions}
                >
                  <Marker 
                    position={{ lat: selectedPlace.lat, lng: selectedPlace.lng }}
                    title={selectedPlace.address}
                  />
                </GoogleMap>
              ) : (
                <div className="h-[200px] bg-muted/50 flex items-center justify-center">
                  <div className="text-center px-4">
                    {!isLoaded ? (
                      <>
                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground">Loading map...</p>
                      </>
                    ) : (
                      <>
                        <MapPin className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground text-center">
                          Enter an address to view location
                        </p>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {selectedPlace && (
              <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
                <h4 className="text-sm font-medium text-foreground">Selected Location</h4>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p><strong>Address:</strong> {selectedPlace.address}</p>
                  <p><strong>Coordinates:</strong> {selectedPlace.lat.toFixed(6)}, {selectedPlace.lng.toFixed(6)}</p>
                  <p><strong>Place ID:</strong> {selectedPlace.placeId}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ComponentErrorBoundary>
  );
};