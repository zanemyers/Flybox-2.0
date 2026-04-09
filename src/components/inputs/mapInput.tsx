'use client'

import "leaflet/dist/leaflet.css";
import { MapProps } from "@/lib/base/types/inputTypes";
import L from "leaflet";
import { useState, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";

// Fix Leaflet's broken default marker icons in Next.js/webpack
const markerIcon = L.icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
});

export default function MapInput(props: MapProps) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const [position, setPosition] = useState<[number, number]>([props.latitude, props.longitude]);

    useEffect(() => {
        const lat = Number.isNaN(props.latitude) ? 44.427963 : props.latitude;
        const lng = Number.isNaN(props.longitude) ? -110.588455 : props.longitude;
        setPosition([lat, lng]);
    }, [props.latitude, props.longitude]);

    // Open/close the native <dialog> based on props.show
    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (props.show) dialog.showModal();
        else if (dialog.open) dialog.close();
    }, [props.show]);

    function LocationSelector() {
        useMapEvents({
            click(e) {
                setPosition([e.latlng.lat, e.latlng.lng]);
                props.onChange(e.latlng.lat, e.latlng.lng);
                props.onClose();
            },
        });
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
        <dialog ref={dialogRef} className="modal" onClose={props.onClose}>
            <div className="modal-box w-11/12 max-w-3xl p-0 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-base-300">
                    <h3 className="font-semibold text-lg">Select a Location</h3>
                    <button
                        type="button"
                        className="btn btn-sm btn-circle btn-ghost"
                        onClick={props.onClose}
                    >
                        ✕
                    </button>
                </div>

                {/* Map */}
                <MapContainer
                    center={position}
                    zoom={10}
                    style={{ height: "500px", width: "100%" }}
                >
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
                                props.onChange(latLng.lat, latLng.lng);
                            },
                        }}
                    />
                    <LocationSelector />
                    <ResizeOnShow active={props.show} />
                </MapContainer>
            </div>

            {/* Click backdrop to close */}
            <div className="modal-backdrop" onClick={props.onClose} />
        </dialog>
    );
}
