"use client";

import { useRef, useMemo, useCallback } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface LocationPickerMapProps {
  lat: number;
  lng: number;
  onLocationChange: (lat: number, lng: number) => void;
}

// Custom marker icon (cyan pin)
const pinIcon = L.divIcon({
  className: "",
  html: `<div style="width:24px;height:24px;position:relative">
    <div style="width:24px;height:24px;background:#00d4ff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.4)"></div>
  </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 24],
});

function ClickHandler({ onLocationChange }: { onLocationChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onLocationChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function DraggableMarker({
  lat,
  lng,
  onLocationChange,
}: LocationPickerMapProps) {
  const markerRef = useRef<L.Marker>(null);

  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (marker) {
          const pos = marker.getLatLng();
          onLocationChange(pos.lat, pos.lng);
        }
      },
    }),
    [onLocationChange]
  );

  return (
    <Marker
      draggable
      position={[lat, lng]}
      ref={markerRef}
      eventHandlers={eventHandlers}
      icon={pinIcon}
    />
  );
}

export default function LocationPickerMap({ lat, lng, onLocationChange }: LocationPickerMapProps) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={15}
      style={{ height: "100%", width: "100%" }}
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onLocationChange={onLocationChange} />
      <DraggableMarker lat={lat} lng={lng} onLocationChange={onLocationChange} />
    </MapContainer>
  );
}
