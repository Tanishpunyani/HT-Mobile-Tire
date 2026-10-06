import Image from "next/image";
import { MapPin, Navigation, ExternalLink, AlertTriangle } from "lucide-react";

interface StaticMapPreviewProps {
  latitude?: number | null;
  longitude?: number | null;
  address: string;
  isEmergency?: boolean;
  className?: string;
  zoom?: number;
}

export default function StaticMapPreview({
  latitude,
  longitude,
  address,
  isEmergency = false,
  className = "",
  zoom = 15,
}: StaticMapPreviewProps) {
  const apiKey =
    process.env.GOOGLE_MAPS_SERVER_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const hasCoords = typeof latitude === "number" && typeof longitude === "number";

  const googleMapsNavUrl = hasCoords
    ? `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

  const staticMapUrl =
    hasCoords && apiKey
      ? `https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}&zoom=${zoom}&size=600x320&scale=2&maptype=roadmap&markers=color:red%7Clabel:${
          isEmergency ? "E" : "T"
        }%7C${latitude},${longitude}&key=${apiKey}`
      : null;

  return (
    <div
      className={`overflow-hidden rounded-[16px] border ${
        isEmergency ? "border-red-300 bg-red-50/30" : "border-border bg-white"
      } shadow-sm ${className}`}
    >
      {/* Map Header / Banner */}
      <div className="flex items-center justify-between border-b border-border bg-slate-50 px-4 py-2.5 text-xs font-semibold">
        <div className="flex items-center gap-1.5 text-foreground">
          {isEmergency ? (
            <AlertTriangle size={15} className="text-red-600" />
          ) : (
            <MapPin size={15} className="text-primary" />
          )}
          <span>{isEmergency ? "Emergency Service Map" : "Service Location Map"}</span>
        </div>

        <a
          href={googleMapsNavUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline font-bold"
        >
          <Navigation size={13} />
          <span>Start Navigation →</span>
        </a>
      </div>

      {/* Map Body */}
      <div className={`relative ${isEmergency ? "h-64 sm:h-72" : "h-48 sm:h-56"} w-full bg-slate-100`}>
        {staticMapUrl ? (
          <Image
            src={staticMapUrl}
            alt={`Map location for ${address}`}
            fill
            className="object-cover"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-slate-100 to-slate-200">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-full ${
                isEmergency ? "bg-red-600 text-white" : "bg-primary text-white"
              } shadow-md`}
            >
              <MapPin size={24} />
            </div>

            <p className="mt-3 text-xs font-bold text-foreground max-w-sm truncate">
              {address}
            </p>

            {hasCoords && (
              <p className="mt-1 text-[11px] text-slate-500 font-mono">
                GPS: {latitude?.toFixed(5)}, {longitude?.toFixed(5)}
              </p>
            )}

            <a
              href={googleMapsNavUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-foreground border border-border shadow-sm hover:bg-slate-50"
            >
              <ExternalLink size={13} className="text-primary" />
              Open Live Route in Google Maps
            </a>
          </div>
        )}

        {isEmergency && (
          <div className="absolute top-3 left-3 rounded-full bg-red-600 px-3 py-1 text-[11px] font-bold text-white shadow-md flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-white animate-ping" />
            URGENT ROADSIDE PIN
          </div>
        )}
      </div>

      {/* Footer Address */}
      <div className="p-3 bg-white border-t border-border">
        <p className="text-xs text-text-secondary">
          <strong className="text-foreground">Destination:</strong> {address}
        </p>
      </div>
    </div>
  );
}
