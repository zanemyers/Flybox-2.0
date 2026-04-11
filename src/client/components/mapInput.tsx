'use client'

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";

const markerIcon = L.icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
});

export default function MapInput({ show, onClose, latitude, longitude, onChange }: {
    show: boolean;
    onClose: () => void;
    latitude: number;
    longitude: number;
    onChange: (lat: number, lng: number) => void;
}) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const [position, setPosition] = useState<[number, number]>([latitude, longitude]);
    const [search, setSearch] = useState("");
    const [flyTo, setFlyTo] = useState<[number, number] | null>(null);

    const handleSearch = async () => {
        if (!search.trim()) return;
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(search)}&format=json&limit=1`);
        const data = await res.json() as { lat: string; lon: string }[];
        if (data.length > 0) {
            const lat = Number(data[0].lat);
            const lng = Number(data[0].lon);
            setPosition([lat, lng]);
            setFlyTo([lat, lng]);
        }
    };

    useEffect(() => {
        const lat = Number.isNaN(latitude) ? 44.427963 : latitude;
        const lng = Number.isNaN(longitude) ? -110.588455 : longitude;
        setPosition([lat, lng]);
    }, [latitude, longitude]);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (show) dialog.showModal();
        else if (dialog.open) dialog.close();
    }, [show]);

    function LocationSelector() {
        useMapEvents({
            click(e) {
                setPosition([e.latlng.lat, e.latlng.lng]);
                onChange(e.latlng.lat, e.latlng.lng);
                onClose();
            },
        });
        return null;
    }

    function FlyToLocation({ target }: { target: [number, number] | null }) {
        const map = useMap();
        useEffect(() => {
            if (target) map.flyTo(target, map.getZoom());
        }, [target, map]);
        return null;
    }

    function ResizeOnShow({ active }: { active: boolean }) {
        const map = useMap();
        useEffect(() => {
            if (active) {
                setTimeout(() => {
                    map.invalidateSize();
                    map.setView(position);
                }, 200);
            }
        }, [active, map]);
        return null;
    }

    return (
        <dialog ref={dialogRef} className="modal" onClose={onClose}>
            <div className="modal-box w-11/12 max-w-3xl p-0 overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-base-300">
                    <h3 className="font-semibold text-lg">Select a Location</h3>
                    <button type="button" className="btn btn-sm btn-circle btn-ghost" onClick={onClose}>✕</button>
                </div>

                <div className="flex gap-2 px-6 py-3 border-b border-base-300">
                    <input
                        type="text"
                        className="input input-bordered w-full"
                        placeholder="Search for a location..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleSearch(); } }}
                    />
                    <button type="button" className="btn btn-primary" onClick={handleSearch}>Search</button>
                </div>

                <MapContainer center={position} zoom={10} style={{ height: "460px", width: "100%" }}>
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution="Map data © OpenStreetMap contributors"
                    />
                    <Marker
                        position={position}
                        icon={markerIcon}
                        draggable
                        eventHandlers={{
                            dragend: (e) => {
                                const latLng = (e.target as L.Marker).getLatLng();
                                setPosition([latLng.lat, latLng.lng]);
                                onChange(latLng.lat, latLng.lng);
                            },
                        }}
                    />
                    <LocationSelector />
                    <ResizeOnShow active={show} />
                    <FlyToLocation target={flyTo} />
                </MapContainer>
            </div>

            <div className="modal-backdrop" onClick={onClose} />
        </dialog>
    );
}
