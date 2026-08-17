"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useRef, useState } from "react";
import { FiCrosshair, FiSearch, FiX } from "react-icons/fi";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";

const markerIcon = L.icon({
  iconUrl: "/leaflet/marker-icon.png",
  iconRetinaUrl: "/leaflet/marker-icon-2x.png",
  shadowUrl: "/leaflet/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});

const DEFAULT_LAT = 44.427963;
const DEFAULT_LNG = -110.588455;

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;
const fmt = (n: number) => (Number.isFinite(n) ? n.toFixed(6) : "—");

/* Defined at module scope on purpose: as inner functions they were fresh
   component types on every render, so React unmounted and remounted them,
   re-firing flyTo/setView and leaking the invalidateSize timeout. */

function LocationSelector({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FlyToLocation({ target }: { target: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) map.setView(target, map.getZoom());
    else map.flyTo(target, map.getZoom());
  }, [target, map]);
  return null;
}

function ResizeOnShow({ active, position }: { active: boolean; position: [number, number] }) {
  const map = useMap();
  const posRef = useRef(position);
  posRef.current = position;

  useEffect(() => {
    if (!active) return;
    // Leaflet measures 0x0 inside a just-opened <dialog>; remeasure after paint.
    const id = setTimeout(() => {
      map.invalidateSize();
      map.setView(posRef.current);
    }, 200);
    return () => clearTimeout(id);
  }, [active, map]);
  return null;
}

export default function MapInput({ latitude, longitude, onChange }: { latitude: number; longitude: number; onChange: (lat: number, lng: number) => void }) {
  const [show, setShow] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [position, setPosition] = useState<[number, number]>([latitude, longitude]);
  const [search, setSearch] = useState("");
  const [flyTo, setFlyTo] = useState<[number, number] | null>(null);
  const [searchError, setSearchError] = useState("");

  const handleSearch = async () => {
    if (!search.trim()) return;
    setSearchError("");
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(search)}&format=json&limit=1`);
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { lat: string; lon: string }[];
      if (data.length === 0) {
        setSearchError("No match for that place.");
        return;
      }
      const lat = Number(data[0].lat);
      const lng = Number(data[0].lon);
      setPosition([lat, lng]);
      setFlyTo([lat, lng]);
      onChange(round6(lat), round6(lng));
    } catch {
      setSearchError("Location lookup failed. Try again.");
    }
  };

  useEffect(() => {
    const lat = Number.isFinite(latitude) ? latitude : DEFAULT_LAT;
    const lng = Number.isFinite(longitude) ? longitude : DEFAULT_LNG;
    setPosition([lat, lng]);
  }, [latitude, longitude]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (show) dialog.showModal();
    else if (dialog.open) dialog.close();
  }, [show]);

  const pick = (lat: number, lng: number) => {
    setPosition([lat, lng]);
    onChange(round6(lat), round6(lng));
  };

  return (
    <div className="w-full">
      {/* items-end is what aligns the button against the labeled readouts — keep it. */}
      {/* Position is the one required input, but it is two spans and a button —
          nothing announced when it changed. */}
      <output aria-live="polite" className="sr-only">
        Position {fmt(latitude)}, {fmt(longitude)}
      </output>
      <div className="well grid grid-cols-[1fr_1fr_auto] items-end gap-x-3">
        <div>
          <span className="eyebrow mb-1 block">Latitude</span>
          <span className="readout block text-sm text-accent">{fmt(latitude)}</span>
        </div>
        <div>
          <span className="eyebrow mb-1 block">Longitude</span>
          <span className="readout block text-sm text-accent">{fmt(longitude)}</span>
        </div>
        <button
          type="button"
          className="btn btn-square btn-ghost size-10 border border-stroke"
          onClick={() => setShow(true)}
          aria-label={`Pick location on map. Currently ${fmt(latitude)}, ${fmt(longitude)}`}
        >
          <FiCrosshair className="size-4 text-primary" />
        </button>
      </div>

      <dialog ref={dialogRef} className="modal" onClose={() => setShow(false)}>
        <div className="modal-box panel max-h-dvh w-full max-w-none overflow-y-auto rounded-none bg-base-200 p-0 shadow-none sm:w-11/12 sm:max-w-3xl sm:rounded-box">
          <div className="panel-head">
            <span className="eyebrow">Select position</span>
            <button type="button" className="icon-btn" aria-label="Close" onClick={() => setShow(false)}>
              <FiX className="size-4" />
            </button>
          </div>

          <div className="border-b border-rule px-4 py-3 sm:px-5">
            <div className="flex gap-2">
              <input
                type="text"
                className="field"
                placeholder="Search for a place…"
                aria-label="Search for a place"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void handleSearch();
                  }
                }}
              />
              <button type="button" className="btn btn-primary h-10 sm:h-9" onClick={handleSearch} aria-label="Search">
                <FiSearch className="size-4" />
                <span className="hidden sm:inline">Search</span>
              </button>
            </div>
            {searchError && (
              <p role="alert" className="mt-1.5 text-xs text-error">
                {searchError}
              </p>
            )}
          </div>

          <MapContainer
            center={position}
            zoom={10}
            style={{ height: "clamp(12rem, calc(100dvh - 13rem), 28rem)", width: "100%" }}
            maxBounds={[
              [-90, -180],
              [90, 180],
            ]}
            maxBoundsViscosity={1.0}
          >
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="Map data © OpenStreetMap contributors" />
            <Marker
              position={position}
              icon={markerIcon}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const latLng = (e.target as L.Marker).getLatLng();
                  pick(latLng.lat, latLng.lng);
                },
              }}
            />
            <LocationSelector onPick={pick} />
            <ResizeOnShow active={show} position={position} />
            <FlyToLocation target={flyTo} />
          </MapContainer>

          <div className="panel-head border-t border-b-0">
            <span className="readout whitespace-nowrap text-xs text-accent">
              {fmt(position[0])}, {fmt(position[1])}
            </span>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setShow(false)}>
              Use this position
            </button>
          </div>
        </div>

        {/* biome-ignore lint/a11y/noStaticElementInteractions: modal backdrop overlay */}
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: Escape key handled by dialog element */}
        <div className="modal-backdrop" onClick={() => setShow(false)} />
      </dialog>
    </div>
  );
}
