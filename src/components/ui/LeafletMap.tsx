'use client';
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface MapProps {
  center: [number, number];
  zoom: number;
  markers: {
    id: string;
    position: [number, number];
    title: string;
    popup?: string;
  }[];
  className?: string;
  onClickMap?: (lat: number, lng: number) => void;
}

interface MyMarker extends L.Marker {
  _myId?: string;
}

const LeafletMap = ({ center, zoom, markers, className, onClickMap }: MapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<MyMarker[]>([]);
  const onClickMapRef = useRef(onClickMap);

  useEffect(() => {
    onClickMapRef.current = onClickMap;
  }, [onClickMap]);

  // Fix Leaflet icon issue
  useEffect(() => {
    // @ts-expect-error Leaflet internal icons cleanup
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });
  }, []);

  // Map Initialization & Unmount
  useEffect(() => {
    if (!mapRef.current) return;
    if (mapInstanceRef.current) return;

    const map = L.map(mapRef.current).setView([center[0], center[1]], zoom);
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    map.on('click', (e) => {
      if (onClickMapRef.current) {
        onClickMapRef.current(e.latlng.lat, e.latlng.lng);
      }
    });

    return () => {
      markersRef.current.forEach(m => {
        try {
          if (map.hasLayer(m)) {
            m.remove();
          }
        } catch (err) { 
          console.debug("Marker removal cleanup", err); 
        }
      });
      markersRef.current = [];
      try {
        map.remove();
      } catch (err) {
        console.debug("Map removal cleanup", err);
      }
      mapInstanceRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update center and zoom
  useEffect(() => {
    if (mapInstanceRef.current) {
      const map = mapInstanceRef.current;
      const currentCenter = map.getCenter();
      if (currentCenter.lat !== center[0] || currentCenter.lng !== center[1]) {
        map.setView([center[0], center[1]], zoom);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center[0], center[1], zoom]);

  // Update markers
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    const newMarkerIds = new Set(markers.map(m => m.id));
    
    // Clear removed markers
    const currentMarkers = [...markersRef.current];
    const survivingMarkers: MyMarker[] = [];

    currentMarkers.forEach(m => {
      if (!newMarkerIds.has(m._myId || '')) {
        try {
          if (map.hasLayer(m)) {
            m.remove();
          }
        } catch (err) {
          console.warn("Marker remove error:", err);
        }
      } else {
        survivingMarkers.push(m);
      }
    });
    markersRef.current = survivingMarkers;

    // Add new markers or update existing
    markers.forEach(m => {
      if (!Array.isArray(m.position) || typeof m.position[0] !== 'number' || typeof m.position[1] !== 'number') return;

      const existingMarker = markersRef.current.find(marker => marker._myId === m.id);
      const popupContent = `<b>${m.title}</b>${m.popup ? `<br/>${m.popup}` : ''}`;
      
      if (existingMarker) {
        try {
          const latLng = existingMarker.getLatLng();
          if (latLng.lat !== m.position[0] || latLng.lng !== m.position[1]) {
            existingMarker.setLatLng(m.position);
          }
          if (existingMarker.getPopup()?.getContent() !== popupContent) {
            existingMarker.setPopupContent(popupContent);
          }
        } catch (err) {
           console.warn("Marker update error:", err);
           // If update fails, maybe re-add it?
        }
      } else {
        try {
          const marker = L.marker(m.position)
            .addTo(map)
            .bindPopup(popupContent) as MyMarker;
          marker._myId = m.id;
          markersRef.current.push(marker);
        } catch (err) {
          console.warn("Marker create error:", err);
        }
      }
    });
  }, [markers]);

  return (
    <div className={className} style={{ width: '100%', height: '100%', zIndex: 0, position: 'relative' }}>
      <div ref={mapRef} style={{ width: '100%', height: '100%', position: 'absolute', inset: 0 }} />
    </div>
  );
};

export default LeafletMap;
