"use client";

import { useState } from "react";
import { Navigation, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import type { StructuredAddress } from "./AddressAutocomplete";

interface GpsLocationButtonProps {
  onLocationFound: (address: StructuredAddress) => void;
  variant?: "emergency" | "standard";
  className?: string;
  label?: string;
}

export default function GpsLocationButton({
  onLocationFound,
  variant = "standard",
  className = "",
  label,
}: GpsLocationButtonProps) {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function handleGetLocation() {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!navigator.geolocation) {
      setErrorMessage("Geolocation is not supported by your browser.");
      return;
    }

    setLoading(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        try {
          // Reverse geocode the coordinates via backend API
          const res = await fetch("/api/geocode/reverse", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat, lng }),
          });

          const data = await res.json();

          if (res.ok && data.success && data.address) {
            onLocationFound(data.address);
            setSuccessMessage("GPS coordinates detected successfully!");
            setTimeout(() => setSuccessMessage(null), 3000);
          } else {
            // Fallback: use raw coordinates
            const fallback: StructuredAddress = {
              formattedAddress: `GPS Location: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
              lat,
              lng,
            };
            onLocationFound(fallback);
            setSuccessMessage("GPS coordinates recorded.");
            setTimeout(() => setSuccessMessage(null), 3000);
          }
        } catch (err) {
          console.error("Reverse geocoding error:", err);
          const fallback: StructuredAddress = {
            formattedAddress: `GPS Location: ${lat.toFixed(5)}, ${lng.toFixed(5)}`,
            lat,
            lng,
          };
          onLocationFound(fallback);
        } finally {
          setLoading(false);
        }
      },
      (error) => {
        setLoading(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setErrorMessage("Location permission denied. Please allow browser location access or type your address.");
            break;
          case error.POSITION_UNAVAILABLE:
            setErrorMessage("Location signal unavailable. Please type your street address.");
            break;
          case error.TIMEOUT:
            setErrorMessage("Location request timed out. Please try again or enter manually.");
            break;
          default:
            setErrorMessage("Unable to detect location. Please type your address.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  }

  const isEmergency = variant === "emergency";

  return (
    <div className={`w-full ${className}`}>
      <button
        type="button"
        onClick={handleGetLocation}
        disabled={loading}
        className={`group flex w-full items-center justify-center gap-2.5 rounded-xl py-3 px-4 text-xs font-bold transition-all duration-200 disabled:opacity-50 ${
          isEmergency
            ? "bg-red-600 text-white hover:bg-red-700 shadow-md shadow-red-500/20 active:scale-[0.99]"
            : "border border-border bg-slate-50 text-foreground hover:bg-slate-100 hover:border-primary/40"
        }`}
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin text-current" />
        ) : (
          <Navigation
            size={16}
            className={`transition-transform duration-200 group-hover:scale-110 ${
              isEmergency ? "text-white" : "text-primary"
            }`}
          />
        )}
        <span>
          {loading
            ? isEmergency
              ? "Detecting Roadside GPS Location..."
              : "Detecting Current Location..."
            : label ||
              (isEmergency
                ? "📍 Auto-Detect My Roadside GPS Location"
                : "📍 Set My Current Location")}
        </span>
      </button>

      {errorMessage && (
        <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-red-50 p-2.5 text-[11px] font-medium text-red-700 border border-red-200">
          <AlertCircle size={14} className="mt-0.5 shrink-0 text-red-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-green-50 p-2 text-[11px] font-medium text-green-700 border border-green-200">
          <CheckCircle2 size={14} className="shrink-0 text-green-600" />
          <span>{successMessage}</span>
        </div>
      )}
    </div>
  );
}
