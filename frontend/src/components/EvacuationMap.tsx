import React, { useEffect, useRef } from 'react';
import L from 'leaflet';

interface Shelter {
  name: string;
  lat: number;
  lon: number;
  distance: string;
}

interface EvacuationMapProps {
  lat: number;
  lon: number;
  shelters: Shelter[];
}

export const EvacuationMap: React.FC<EvacuationMapProps> = ({ lat, lon, shelters }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Clean up existing map instance if any
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    try {
      // 1. Initialize map centered on user coordinates
      const map = L.map(mapContainerRef.current).setView([lat, lon], 14);
      mapRef.current = map;

      // 2. Add OpenStreetMap tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      // 3. Add Custom Pulsing User Location Marker
      const userIcon = L.divIcon({
        className: 'custom-user-marker',
        html: `
          <div style="
            position: relative;
            width: 16px;
            height: 16px;
            background-color: #38bdf8;
            border: 2px solid #ffffff;
            border-radius: 50%;
            box-shadow: 0 0 12px #38bdf8;
          ">
            <div style="
              position: absolute;
              top: -6px;
              left: -6px;
              width: 24px;
              height: 24px;
              border: 2px dashed #38bdf8;
              border-radius: 50%;
              animation: spin 6s linear infinite;
            "></div>
          </div>
        `,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      L.marker([lat, lon], { icon: userIcon })
        .addTo(map)
        .bindPopup('<strong>Your Current Location</strong><br/>Emergency area coordinates logged.')
        .openPopup();

      // 4. Add Evacuation Shelter Markers
      shelters.forEach(shelter => {
        const shelterIcon = L.divIcon({
          className: 'custom-shelter-marker',
          html: `
            <div style="
              width: 20px;
              height: 20px;
              background-color: #f59e0b;
              border: 2px solid #ffffff;
              border-radius: 50%;
              box-shadow: 0 0 15px #f59e0b;
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <span style="color: #ffffff; font-size: 10px; font-weight: 800; font-family: sans-serif;">S</span>
            </div>
          `,
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        });

        L.marker([shelter.lat, shelter.lon], { icon: shelterIcon })
          .addTo(map)
          .bindPopup(`<strong>${shelter.name}</strong><br/>Distance: ${shelter.distance}`);
      });
    } catch (err) {
      console.error('[EVACUATION MAP] Leaflet initialization error:', err);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [lat, lon, shelters]);

  return (
    <div className="card map-card" id="evacuation-map-element">
      <h2>Emergency Evacuation Shelter Map</h2>
      <div className="leaflet-container-wrapper">
        <div ref={mapContainerRef} style={{ height: '100%', width: '100%' }}></div>
      </div>
      <div className="map-shelter-info">
        {shelters.map((shelter, index) => (
          <div key={index} className="shelter-box">
            <div>
              <span className="shelter-name">{shelter.name}</span>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>
                Lat: {shelter.lat.toFixed(4)}, Lon: {shelter.lon.toFixed(4)}
              </p>
            </div>
            <span className="shelter-distance">{shelter.distance}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
