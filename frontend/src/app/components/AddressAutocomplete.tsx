"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { MapPin, X, Loader2, CheckCircle2, Check } from "lucide-react";

export interface StructuredAddress {
  formattedAddress: string;
  streetNumber?: string;
  route?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  lat?: number;
  lng?: number;
}

interface AddressAutocompleteProps {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect?: (place: StructuredAddress) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  error?: string;
  disabled?: boolean;
}

export interface SuggestionItem {
  value: string;
  subtext?: string;
  latitude?: number;
  longitude?: number;
  type?: string;
}

export default function AddressAutocomplete({
  id = "address-autocomplete",
  name = "location",
  value,
  onChange,
  onPlaceSelect,
  placeholder = "Enter street address, city, or workplace location",
  required = false,
  className = "",
  error,
  disabled = false,
}: AddressAutocompleteProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isSelectedRef = useRef(false);
  const lastFetchedQueryRef = useRef("");

  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [selectedPlace, setSelectedPlace] = useState<StructuredAddress | null>(null);

  const fetchSuggestions = useCallback(async (query: string) => {
    const trimmed = query.trim();
    if (trimmed.length < 3 || isSelectedRef.current) {
      setSuggestions([]);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    if (trimmed === lastFetchedQueryRef.current) {
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsLoading(true);

    try {
      const res = await fetch(
        `/api/address/autocomplete?q=${encodeURIComponent(trimmed)}`,
        { signal: controller.signal }
      );

      if (!res.ok) {
        setSuggestions([]);
        setIsOpen(false);
        setIsLoading(false);
        return;
      }

      const data = await res.json();
      const list: SuggestionItem[] = Array.isArray(data?.suggestions)
        ? data.suggestions
        : [];

      lastFetchedQueryRef.current = trimmed;
      setSuggestions(list);
      setIsOpen(list.length > 0);
      setActiveIndex(-1);
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        setSuggestions([]);
        setIsOpen(false);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 350ms debounce on input changes
  useEffect(() => {
    if (isSelectedRef.current) {
      return;
    }

    const trimmed = value.trim();
    if (trimmed.length < 3) {
      setSuggestions([]);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      fetchSuggestions(trimmed);
    }, 350);

    return () => {
      clearTimeout(timer);
    };
  }, [value, fetchSuggestions]);

  // Click outside to close suggestion dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  function handleSelectSuggestion(item: SuggestionItem) {
    isSelectedRef.current = true;
    const fullAddress =
      item.subtext && !item.value.includes(item.subtext)
        ? `${item.value}, ${item.subtext}`
        : item.value;

    const structured: StructuredAddress = {
      formattedAddress: fullAddress,
      lat: item.latitude,
      lng: item.longitude,
    };

    setSelectedPlace(structured);
    setSuggestions([]);
    setIsOpen(false);
    setActiveIndex(-1);
    lastFetchedQueryRef.current = fullAddress.trim();

    onChange(fullAddress);
    if (onPlaceSelect) {
      onPlaceSelect(structured);
    }

    if (inputRef.current) {
      inputRef.current.focus();
    }
  }

  function handleInputChange(text: string) {
    isSelectedRef.current = false;
    if (selectedPlace && text !== selectedPlace.formattedAddress) {
      setSelectedPlace(null);
    }
    onChange(text);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === "ArrowDown" && suggestions.length > 0) {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case "Enter":
        if (activeIndex >= 0 && activeIndex < suggestions.length) {
          e.preventDefault();
          handleSelectSuggestion(suggestions[activeIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        setActiveIndex(-1);
        break;
      default:
        break;
    }
  }

  function handleClear() {
    isSelectedRef.current = false;
    setSelectedPlace(null);
    setSuggestions([]);
    setIsOpen(false);
    setActiveIndex(-1);
    lastFetchedQueryRef.current = "";
    onChange("");
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <MapPin
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-primary pointer-events-none"
          size={18}
        />

        <input
          ref={inputRef}
          id={id}
          name={name}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls={`${id}-suggestions`}
          required={required}
          disabled={disabled}
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (!isSelectedRef.current && suggestions.length > 0) {
              setIsOpen(true);
            }
          }}
          placeholder={placeholder}
          autoComplete="off"
          className={`w-full rounded-[10px] border py-3 pl-10 pr-10 text-sm text-foreground outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/10 ${
            error
              ? "border-red-400 bg-red-50/20"
              : "border-border bg-white"
          } ${className}`}
        />

        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {isLoading && (
            <Loader2
              size={16}
              className="animate-spin text-primary"
              aria-label="Loading suggestions"
            />
          )}

          {value && (
            <button
              type="button"
              onClick={handleClear}
              className="text-slate-400 hover:text-foreground transition-colors p-0.5"
              aria-label="Clear address"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Suggestion Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <ul
          id={`${id}-suggestions`}
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1.5 z-50 max-h-64 overflow-y-auto rounded-[12px] border border-border bg-white py-1.5 shadow-xl transition-all"
        >
          {suggestions.map((item, index) => {
            const isActive = index === activeIndex;
            return (
              <li
                key={`${item.value}-${item.subtext || ""}-${index}`}
                role="option"
                aria-selected={isActive}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => handleSelectSuggestion(item)}
                className={`flex items-start gap-2.5 px-3.5 py-2.5 text-xs text-foreground cursor-pointer transition-colors ${
                  isActive ? "bg-primary/10 text-primary font-medium" : "hover:bg-slate-50"
                }`}
              >
                <MapPin
                  size={15}
                  className={`shrink-0 mt-0.5 ${isActive ? "text-primary" : "text-slate-400"}`}
                />
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="font-medium truncate text-foreground">{item.value}</span>
                  {item.subtext && (
                    <span className="text-[11px] text-slate-500 truncate">{item.subtext}</span>
                  )}
                </div>
                {isActive && <Check size={14} className="text-primary shrink-0 self-center" />}
              </li>
            );
          })}
        </ul>
      )}

      {selectedPlace && typeof selectedPlace.lat === "number" && typeof selectedPlace.lng === "number" && (
        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-green-700">
          <CheckCircle2 size={13} className="text-green-600" />
          <span>
            Verified Location (GPS: {selectedPlace.lat.toFixed(4)}, {selectedPlace.lng.toFixed(4)})
          </span>
        </div>
      )}

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
