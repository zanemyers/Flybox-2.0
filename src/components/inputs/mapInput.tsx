'use client'

import "leaflet/dist/leaflet.css";
import {MapProps} from "@/lib/base/types/inputTypes";
import L from "leaflet";
import { useState, useEffect } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";


/**
 * Renders a modal with a Leaflet map allowing the user to select a location.
 * Supports both clicking on the map and dragging the marker.
 */
export default function MapInput(props: MapProps) {
    // Current position state [latitude, longitude]
    const [position, setPosition] = useState<[number, number]>([props.latitude, props.longitude]);

    // Update position if props change
    useEffect(() => {
        setPosition(() => {
            const lat = Number.isNaN(props.latitude) ? 44.427963 : props.latitude;
            const lng = Number.isNaN(props.longitude) ? -110.588455 : props.longitude;
            return [lat, lng];
        });
    }, [props.latitude, props.longitude]);

    /**
     * Component to handle map clicks for selecting location
     */
    function LocationSelector() {
        useMapEvents({
            click(e) {
                setPosition([e.latlng.lat, e.latlng.lng]);
                props.onChange(e.latlng.lat, e.latlng.lng);
                props.onClose(); // auto-close modal after picking
            },
        });
        return null;
    }

    /**
     * Component to force map resizing when modal opens
     * @param active - whether the modal is visible
     */
    function ResizeOnShow({ active }: { active: boolean }) {
        const map = useMap();
        useEffect(() => {
            if (active) {
                setTimeout(() => {
                    map.invalidateSize(); // fix display size
                    map.setView(position); // recenter map
                }, 200); // small delay for modal animation
            }
        }, [active, map, position]);
        return null;
    }

    return (
        <>
            {/* Backdrop */}
            {props.show && <div className="modal-backdrop fade show"></div>}

            {/* Modal */}
            <div className={`modal fade ${props.show ? "show d-block" : ""}`} tabIndex={-1} role="dialog">
                <div className="modal-dialog modal-lg modal-dialog-centered">
                    <div className="modal-content">
                        {/* Modal Header */}
                        <div className="modal-header">
                            <h5 className="modal-title">Select a Location</h5>
                            <button type="button" className="btn-close" onClick={props.onClose} />
                        </div>

                        {/* Modal Body */}
                        <div className="modal-body overflow-hidden rounded-bottom-3 p-0">
                            <MapContainer center={position} zoom={10} style={{ height: "500px", width: "100%" }}>
                                {/* Map Tiles */}
                                <TileLayer
                                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    attribution="Map data © OpenStreetMap contributors"
                                />

                                {/* Draggable marker */}
                                <Marker
                                    position={position}
                                    draggable={true}
                                    eventHandlers={{
                                        dragend: (e) => {
                                            const lat_lng = (e.target as L.Marker).getLatLng();
                                            setPosition([lat_lng.lat, lat_lng.lng]);
                                            props.onChange(lat_lng.lat, lat_lng.lng);
                                        },
                                    }}
                                />

                                {/* Click handler */}
                                <LocationSelector />

                                {/* Resize map when modal opens */}
                                <ResizeOnShow active={props.show} />
                            </MapContainer>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
