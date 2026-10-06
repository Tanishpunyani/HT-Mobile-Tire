"use client";

import { useEffect, useState, useCallback, FormEvent } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Container from "@/app/components/Container";
import {
  Wrench,
  Car,
  MapPin,
  Send,
  AlertCircle,
  ShieldCheck,
  Sparkles,
  Phone,
  User,
  Mail,
  Calendar,
  Clock,
} from "lucide-react";
import AddressAutocomplete, {
  StructuredAddress,
} from "@/app/components/AddressAutocomplete";
import GpsLocationButton from "@/app/components/GpsLocationButton";
import TireSizeSelector from "@/app/components/TireSizeSelector";
import BookingWaitScreen from "@/app/components/BookingWaitScreen";
import { SERVICE_NAMES, normalizeServiceName } from "@/lib/constants/services";
import { createBookingRequestAction } from "@/app/actions/bookings";
import { getTorontoTodayString } from "@/lib/utils/timezone";

interface DynamicSlot {
  time: string;
  endTime: string;
  label: string;
  available: boolean;
  reason?: "past" | "occupied";
}

type CustomerProfile = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  savedVehicles?: string[];
  savedAddresses?: string[];
};

interface BookingFormClientProps {
  initialCustomer?: CustomerProfile | null;
  initialAvailability?: {
    available: boolean;
    estimatedCompletionAt?: string;
    remainingMinutes?: number;
  } | null;
}

export default function BookingFormClient({
  initialCustomer = null,
  initialAvailability = null,
}: BookingFormClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [customer, setCustomer] = useState<CustomerProfile | null>(initialCustomer);
  const [customerLoading, setCustomerLoading] = useState(!initialCustomer);

  const [selectedService, setSelectedService] = useState<string>("");
  const [locationAddress, setLocationAddress] = useState<string>("");
  const [structuredAddress, setStructuredAddress] = useState<StructuredAddress | null>(null);

  const todayStr = getTorontoTodayString();
  const [bookingDate, setBookingDate] = useState<string>(todayStr);
  const [bookingTime, setBookingTime] = useState<string>("");
  const [slots, setSlots] = useState<DynamicSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const [tireSize, setTireSize] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [activeServiceWait, setActiveServiceWait] = useState<{
    available: boolean;
    estimatedCompletionAt?: string;
    remainingMinutes?: number;
  } | null>(null);

  const fetchSlots = useCallback(async (targetDate: string, desiredTime?: string) => {
    try {
      setSlotsLoading(true);
      const res = await fetch(`/api/bookings/availability?date=${targetDate}`, {
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.slots)) {
        const fetchedSlots: DynamicSlot[] = data.slots;
        setSlots(fetchedSlots);

        setBookingTime((currentTime) => {
          const timeToEvaluate = desiredTime !== undefined ? desiredTime : currentTime;
          if (timeToEvaluate) {
            const matched = fetchedSlots.find((s) => s.time === timeToEvaluate);
            if (matched && matched.available) {
              return timeToEvaluate;
            }
          }
          const firstAvail = fetchedSlots.find((s) => s.available);
          return firstAvail ? firstAvail.time : "";
        });
      }
    } catch (err) {
      console.error("Failed to fetch slots:", err);
    } finally {
      setSlotsLoading(false);
    }
  }, []);

  // Real-time timer: fetch on date change, and poll every 30 seconds
  useEffect(() => {
    fetchSlots(bookingDate);

    const intervalId = setInterval(() => {
      fetchSlots(bookingDate);
    }, 30000);

    return () => clearInterval(intervalId);
  }, [bookingDate, fetchSlots]);

  useEffect(() => {
    const serviceQuery = searchParams.get("service");
    if (serviceQuery) {
      const matched = normalizeServiceName(serviceQuery);
      if (matched) {
        setSelectedService(matched);
      }
    }

    const locationQuery = searchParams.get("location");
    if (locationQuery && locationQuery.trim()) {
      setLocationAddress((prev) => (prev ? prev : locationQuery.trim()));
    }

    const tireSizeQuery = searchParams.get("tireSize");
    if (tireSizeQuery && tireSizeQuery.trim()) {
      setTireSize((prev) => (prev ? prev : tireSizeQuery.trim()));
    }

    const dateQuery = searchParams.get("date");
    if (dateQuery && /^\d{4}-\d{2}-\d{2}$/.test(dateQuery)) {
      setBookingDate(dateQuery);
    }

    const timeQuery = searchParams.get("time");
    if (timeQuery && timeQuery.trim()) {
      setBookingTime(timeQuery.trim());
    }
  }, [searchParams]);

  useEffect(() => {
    if (initialCustomer) {
      setCustomer(initialCustomer);
      setCustomerLoading(false);
      return;
    }

    async function loadCustomer() {
      try {
        const response = await fetch("/api/customer/me");
        if (!response.ok) {
          setCustomer(null);
          return;
        }
        const result = await response.json();
        if (result.success) {
          setCustomer(result.customer);
        }
      } catch (error) {
        console.error("Unable to load customer profile:", error);
        setCustomer(null);
      } finally {
        setCustomerLoading(false);
      }
    }

    loadCustomer();
  }, [initialCustomer]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMsg("");

    if (!locationAddress.trim()) {
      setErrorMsg("Please select or enter your service location address.");
      return;
    }

    setLoading(true);

    const form = event.currentTarget;
    const formData = new FormData(form);

    const selectedDateValue = bookingDate || String(formData.get("bookingDate") || "").trim() || todayStr;
    const selectedTimeValue = bookingTime || String(formData.get("bookingTime") || "").trim();

    if (!selectedTimeValue) {
      setErrorMsg("Please select an available appointment time window.");
      setLoading(false);
      return;
    }

    const data = {
      name: String(formData.get("name") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      service: String(selectedService || formData.get("service") || "").trim(),
      vehicle: String(formData.get("vehicle") || "").trim(),
      location: String(locationAddress || "").trim(),
      formattedAddress: String(structuredAddress?.formattedAddress || locationAddress || "").trim(),
      latitude: typeof structuredAddress?.lat === "number" ? structuredAddress.lat : null,
      longitude: typeof structuredAddress?.lng === "number" ? structuredAddress.lng : null,
      city: structuredAddress?.city || null,
      state: structuredAddress?.state || null,
      zipCode: structuredAddress?.zipCode || null,
      tireSize: tireSize || null,
      bookingDate: selectedDateValue,
      bookingTime: selectedTimeValue,
      scheduledDate: selectedDateValue,
      scheduledTime: selectedTimeValue,
      message: String(formData.get("message") || "").trim(),
    };

    try {
      const result = await createBookingRequestAction(data);

      if (!result.success) {
        if ("code" in result && result.code === "SERVICE_ACTIVE") {
          setActiveServiceWait({
            available: false,
            estimatedCompletionAt: (result as any).estimatedCompletionAt,
            remainingMinutes: (result as any).remainingMinutes,
          });
          setLoading(false);
          return;
        }

        const rawError = result.error || "";
        const isTechnicalError =
          rawError.includes("Transaction API") ||
          rawError.includes("P2028") ||
          rawError.includes("Prisma") ||
          rawError.includes("database") ||
          rawError.includes("SQL") ||
          rawError.includes("timeout") ||
          rawError.includes("Pool");

        const displayError = isTechnicalError
          ? "We couldn't submit your service request right now. Please try again in a moment."
          : rawError || "Unable to submit your booking request. Please verify your details.";

        setErrorMsg(displayError);
        setLoading(false);
        return;
      }

      if ("bookingId" in result && result.bookingId) {
        router.push(`/booking/confirmed?booking_id=${result.bookingId}`);
      }
    } catch {
      setErrorMsg("We couldn't submit your service request right now. Please try again in a moment.");
      setLoading(false);
    }
  }

  if (activeServiceWait) {
    return (
      <BookingWaitScreen
        availability={activeServiceWait}
        onAvailable={() => setActiveServiceWait(null)}
      />
    );
  }

  if (customerLoading) {
    return (
      <div className="min-h-screen bg-background-light">
        <section className="bg-secondary py-20">
          <Container>
            <div className="mx-auto max-w-4xl text-center">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-primary" />
              <p className="mt-4 text-sm font-semibold text-slate-300">
                Loading Booking Information...
              </p>
            </div>
          </Container>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background-light">
      {/* Page Header */}
      <section className="bg-secondary py-16 sm:py-20 border-b border-white/10">
        <Container>
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/20 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-blue-300 border border-primary/30">
              <Sparkles size={13} />
              24/7 On-Demand Mobile Service
            </span>

            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
              Book a Mobile Tire Service
            </h1>

            <p className="mt-4 text-base text-slate-300 sm:text-lg">
              No upfront payment required. We come directly to your home, workplace, or roadside location anytime 24/7.
            </p>
          </div>
        </Container>
      </section>

      {/* Main Form Section */}
      <section className="py-12 sm:py-16">
        <Container>
          <div className="mx-auto max-w-3xl">
            {errorMsg && (
              <div className="mb-8 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700 shadow-sm">
                <AlertCircle className="mt-0.5 shrink-0 text-red-600" size={18} />
                <div>
                  <h4 className="font-bold">Booking Notice</h4>
                  <p className="mt-0.5 text-xs">{errorMsg}</p>
                </div>
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="rounded-3xl border border-border bg-white p-6 shadow-xl shadow-slate-100 sm:p-10"
            >
              <div className="space-y-8">
                {/* Step 1: Customer Contact Information */}
                <div>
                  <h3 className="text-base font-bold text-foreground sm:text-lg border-b border-border pb-3 flex items-center gap-2">
                    <User className="text-primary" size={18} />
                    1. Your Contact Information
                  </h3>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="name" className="mb-1 block text-xs font-bold text-foreground">
                        Full Name *
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-3 text-slate-400" size={16} />
                        <input
                          id="name"
                          name="name"
                          type="text"
                          required
                          defaultValue={customer?.name || ""}
                          placeholder="John Doe"
                          className="w-full rounded-xl border border-border bg-slate-50/50 pl-9 pr-4 py-2.5 text-sm font-medium text-foreground outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="phone" className="mb-1 block text-xs font-bold text-foreground">
                        Phone Number *
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-3 text-slate-400" size={16} />
                        <input
                          id="phone"
                          name="phone"
                          type="tel"
                          required
                          defaultValue={customer?.phone || ""}
                          placeholder="(555) 000-0000"
                          className="w-full rounded-xl border border-border bg-slate-50/50 pl-9 pr-4 py-2.5 text-sm font-medium text-foreground outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
                        />
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label htmlFor="email" className="mb-1 block text-xs font-bold text-foreground">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-3 text-slate-400" size={16} />
                        <input
                          id="email"
                          name="email"
                          type="email"
                          defaultValue={customer?.email || ""}
                          placeholder="john@example.com"
                          className="w-full rounded-xl border border-border bg-slate-50/50 pl-9 pr-4 py-2.5 text-sm font-medium text-foreground outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 2: Tire Service Selection */}
                <div>
                  <h3 className="text-base font-bold text-foreground sm:text-lg border-b border-border pb-3 flex items-center gap-2">
                    <Wrench className="text-primary" size={18} />
                    2. Select Primary Service
                  </h3>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {SERVICE_NAMES.map((serviceName) => {
                      const isSelected = selectedService === serviceName;
                      return (
                        <button
                          key={serviceName}
                          type="button"
                          onClick={() => setSelectedService(serviceName)}
                          className={`flex items-center justify-between rounded-xl border p-4 text-left text-sm font-bold transition-all ${
                            isSelected
                              ? "border-primary bg-primary/5 text-primary shadow-sm"
                              : "border-border bg-slate-50/40 text-foreground hover:bg-slate-100"
                          }`}
                        >
                          <span>{serviceName}</span>
                          <span
                            className={`h-4 w-4 rounded-full border ${
                              isSelected ? "border-primary bg-primary" : "border-slate-300"
                            }`}
                          />
                        </button>
                      );
                    })}
                  </div>
                  <input type="hidden" name="service" value={selectedService} />
                </div>

                {/* Step 3: Tire Size Selection */}
                <TireSizeSelector value={tireSize} onChange={setTireSize} />

                {/* Step 4: Vehicle Details */}
                <div>
                  <h3 className="text-base font-bold text-foreground sm:text-lg border-b border-border pb-3 flex items-center gap-2">
                    <Car className="text-primary" size={18} />
                    4. Your Vehicle
                  </h3>

                  <div className="mt-4">
                    <label htmlFor="vehicle" className="mb-1 block text-xs font-bold text-foreground">
                      Year, Make & Model *
                    </label>
                    <div className="relative">
                      <Car className="absolute left-3 top-3 text-slate-400" size={16} />
                      <input
                        id="vehicle"
                        name="vehicle"
                        type="text"
                        required
                        placeholder="e.g. 2022 Honda Civic Sedan"
                        className="w-full rounded-xl border border-border bg-slate-50/50 pl-9 pr-4 py-2.5 text-sm font-medium text-foreground outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
                      />
                    </div>
                  </div>
                </div>

                {/* Step 5: Location Address */}
                <div>
                  <h3 className="text-base font-bold text-foreground sm:text-lg border-b border-border pb-3 flex items-center gap-2">
                    <MapPin className="text-primary" size={18} />
                    5. Service Location
                  </h3>

                  <div className="mt-4 space-y-3">
                    {/* GPS Current Location Detection Button */}
                    <GpsLocationButton
                      variant="standard"
                      onLocationFound={(addr) => {
                        setLocationAddress(addr.formattedAddress);
                        setStructuredAddress(addr);
                      }}
                    />

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label htmlFor="location-address" className="block text-xs font-bold text-foreground">
                          Street Address or Location *
                        </label>
                        <span className="text-[11px] text-slate-400 font-medium">
                          Or enter manually below
                        </span>
                      </div>
                      <AddressAutocomplete
                        id="location-address"
                        name="location"
                        value={locationAddress}
                        onChange={setLocationAddress}
                        onPlaceSelect={(place: StructuredAddress) => {
                          setStructuredAddress(place);
                        }}
                        placeholder="Enter street address, city, or workplace location"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Step 6: Preferred Appointment Date & Time */}
                <div>
                  <h3 className="text-base font-bold text-foreground sm:text-lg border-b border-border pb-3 flex items-center gap-2">
                    <Calendar className="text-primary" size={18} />
                    6. Date & Time
                  </h3>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="bookingDate" className="mb-1 block text-xs font-bold text-foreground">
                        Service Date *
                      </label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-3 text-slate-400" size={16} />
                        <input
                          id="bookingDate"
                          name="bookingDate"
                          type="date"
                          required
                          min={todayStr}
                          value={bookingDate}
                          onChange={(e) => {
                            const newDate = e.target.value;
                            setBookingDate(newDate);
                            setBookingTime("");
                            fetchSlots(newDate);
                          }}
                          className="w-full rounded-xl border border-border bg-slate-50/50 pl-9 pr-4 py-2.5 text-sm font-medium text-foreground outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label htmlFor="bookingTime" className="block text-xs font-bold text-foreground">
                          Service Time *
                        </label>
                        {slotsLoading && (
                          <span className="text-[11px] text-slate-400 font-medium animate-pulse">
                            Checking slots...
                          </span>
                        )}
                      </div>
                      <div className="relative">
                        <Clock className="absolute left-3 top-3 text-slate-400" size={16} />
                        <select
                          id="bookingTime"
                          name="bookingTime"
                          required
                          value={bookingTime}
                          onChange={(e) => setBookingTime(e.target.value)}
                          className="w-full rounded-xl border border-border bg-slate-50/50 pl-9 pr-4 py-2.5 text-sm font-medium text-foreground outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
                        >
                          {slots.length === 0 ? (
                            <option value="" disabled>
                              Loading available slots...
                            </option>
                          ) : (
                            <>
                              <option value="" disabled>
                                -- Select a 2-Hour Time Window --
                              </option>
                              {slots.map((slot) => {
                                const isPast = slot.reason === "past";
                                const isOccupied = slot.reason === "occupied";
                                const disabled = !slot.available;
                                const statusSuffix = isPast
                                  ? " (Passed)"
                                  : isOccupied
                                  ? " (Unavailable / Booked)"
                                  : "";

                                return (
                                  <option
                                    key={slot.time}
                                    value={slot.time}
                                    disabled={disabled}
                                    className={disabled ? "text-slate-400 bg-slate-100" : "text-slate-900"}
                                  >
                                    {slot.label}{statusSuffix}
                                  </option>
                                );
                              })}
                            </>
                          )}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Step 7: Additional Instructions / Special Notes */}
                <div>
                  <h3 className="text-base font-bold text-foreground sm:text-lg border-b border-border pb-3 flex items-center gap-2">
                    <Sparkles className="text-primary" size={18} />
                    7. Additional Details (Optional)
                  </h3>
                  <div className="mt-4">
                    <label htmlFor="message" className="mb-1 block text-xs font-bold text-foreground">
                      Special Instructions or Notes
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      rows={3}
                      placeholder="e.g., Car is parked in driveway. Key is in lockbox or wheel lock nut key is in glovebox."
                      className="w-full rounded-xl border border-border bg-slate-50/50 px-4 py-2.5 text-sm font-medium text-foreground outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10"
                    />
                  </div>
                </div>

                {/* No Upfront Charge Notice */}
                <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 text-xs text-blue-900">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-2 w-2 rounded-full bg-blue-600" />
                      <span className="font-bold">No Upfront Payment Required</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-bold text-blue-700 shrink-0">
                      <ShieldCheck size={16} />
                      100% Satisfaction Guaranteed
                    </div>
                  </div>
                </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-8 py-4 text-base font-bold text-white shadow-lg shadow-blue-500/25 transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Send size={18} />
                    {loading ? "Submitting Request..." : "Confirm Booking →"}
                  </button>

                  {/* Trust Footer */}
                  <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <ShieldCheck size={14} className="text-primary" />
                      Touchless Rim Guarantee
                    </span>
                    <span>• Instant Service & Email Confirmation</span>
                    <span>• 24/7 Mobile Service</span>
                  </div>
              </div>
            </form>
          </div>
        </Container>
      </section>
    </div>
  );
}
