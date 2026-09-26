"use client";

import { useEffect, useState, type FormEvent, Suspense, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Mail,
  User,
  CalendarDays,
  Siren,
} from "lucide-react";
import Container from "../components/Container";
import { createClient } from "@/lib/supabase/client";
import ReviewModal from "../components/ReviewModal";
import { cancelCustomerBookingAction } from "@/app/actions/bookings";

import { Customer, Booking, EmergencyRequest, ContactInquiry, ErrorState } from "./types";
import AccountLoadingSkeleton from "./components/AccountLoadingSkeleton";
import AccountErrorState from "./components/AccountErrorState";
import AccountProfileCard from "./components/AccountProfileCard";
import BookingHistorySection from "./components/BookingHistorySection";
import EmergencyRequestsSection from "./components/EmergencyRequestsSection";
import ContactInquiriesSection from "./components/ContactInquiriesSection";
import AccountSecuritySection from "./components/AccountSecuritySection";
import CancelBookingModal from "./components/CancelBookingModal";

function AccountPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [emergencyRequests, setEmergencyRequests] = useState<EmergencyRequest[]>([]);
  const [contactInquiries, setContactInquiries] = useState<ContactInquiry[]>([]);

  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [errorState, setErrorState] = useState<ErrorState | null>(null);

  // Tab State
  const validTabs = ["bookings", "emergency", "inquiries", "settings"] as const;
  type TabType = (typeof validTabs)[number];
  const urlTab = searchParams.get("tab") as TabType | null;
  const initialTab = urlTab && validTabs.includes(urlTab) ? urlTab : "bookings";
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  function switchTab(tab: TabType) {
    setActiveTab(tab);
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.set("tab", tab);
    router.replace(`/account?${newParams.toString()}`, { scroll: false });
  }

  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Password Change State
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Onboarding Profile State
  const [onboardingName, setOnboardingName] = useState("");
  const [onboardingPhone, setOnboardingPhone] = useState("");
  const [onboardingSaving, setOnboardingSaving] = useState(false);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);

  // Review & Cancel Modals
  const [reviewModalBooking, setReviewModalBooking] = useState<Booking | null>(null);
  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null);
  const [isCancellingBooking, setIsCancellingBooking] = useState(false);

  // 1. Data Loader for Bookings
  const loadBookings = useCallback(async () => {
    try {
      setBookingsLoading(true);
      const res = await fetch("/api/bookings", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.bookings)) {
          setBookings(data.bookings);
        }
      }
    } catch {
      // Non-fatal background fetch
    } finally {
      setBookingsLoading(false);
    }
  }, []);

  // 2. Data Loader for Customer Profile & Inquiries
  const loadCustomer = useCallback(
    async (isManualRetry = false, isSilent = false) => {
      try {
        if (isManualRetry) setRetrying(true);
        if (!isSilent) setLoading(true);

        const res = await fetch("/api/customer/profile", { cache: "no-store" });

        if (res.status === 401) {
          setErrorState({
            type: "unauthorized",
            message: "Your session has expired. Please sign in again.",
          });
          return;
        }

        if (res.status === 403) {
          setErrorState({
            type: "admin_access",
            message: "This area is for customers only. Administrators should use the Admin Portal.",
          });
          return;
        }

        if (res.status === 404) {
          setErrorState({
            type: "not_found",
            message: "Customer profile not found. Please complete your profile details.",
          });
          return;
        }

        if (!res.ok) {
          setErrorState({
            type: "server_error",
            message: "Database service temporarily unavailable. Please retry.",
          });
          return;
        }

        const data = await res.json();
        if (data.success && data.customer) {
          setCustomer(data.customer);
          setEditName(data.customer.name || "");
          setEditPhone(data.customer.phone || "");
          setEmergencyRequests(data.emergencyRequests || []);
          setContactInquiries(data.contactInquiries || []);
          setErrorState(null);
        } else {
          setErrorState({
            type: "server_error",
            message: data.error || "Unable to get customer profile.",
          });
        }
      } catch {
        setErrorState({
          type: "server_error",
          message: "Database service temporarily unavailable. Please retry.",
        });
      } finally {
        if (!isSilent) setLoading(false);
        if (isManualRetry) setRetrying(false);
      }
    },
    []
  );

  const loadAccountData = useCallback(
    async (isManualRetry = false, isSilent = false) => {
      await Promise.all([loadCustomer(isManualRetry, isSilent), loadBookings()]);
    },
    [loadCustomer, loadBookings]
  );

  // Initial Load
  useEffect(() => {
    void loadAccountData();
  }, [loadAccountData]);

  // Realtime Subscriptions
  useEffect(() => {
    if (!customer?.id) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`customer-bookings-${customer.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "bookings",
          filter: `customer_id=eq.${customer.id}`,
        },
        () => {
          loadBookings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [customer?.id, loadBookings]);

  // Window Focus Sync
  useEffect(() => {
    function handleWindowFocus() {
      if (customer) {
        void loadAccountData(false, true);
      }
    }

    window.addEventListener("focus", handleWindowFocus);
    return () => {
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [customer, loadAccountData]);

  // Realtime Customer Inquiries & Emergency Requests
  useEffect(() => {
    if (!customer?.id) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`customer-inquiries-${customer.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notification_logs",
        },
        () => {
          loadCustomer(false, true);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "contact_messages",
        },
        () => {
          loadCustomer(false, true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [customer?.id, loadCustomer]);

  async function handleProfileSubmit(e: FormEvent) {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMessage(null);

    try {
      const res = await fetch("/api/customer/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          phone: editPhone.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.customer) {
        setCustomer(data.customer);
        setProfileMessage({
          type: "success",
          text: "Profile updated successfully.",
        });
        setIsEditingProfile(false);
      } else {
        setProfileMessage({
          type: "error",
          text: data.error || "Failed to update profile.",
        });
      }
    } catch {
      setProfileMessage({
        type: "error",
        text: "Database service temporarily unavailable. Please retry.",
      });
    } finally {
      setProfileSaving(false);
    }
  }

  async function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    setPasswordSaving(true);
    setPasswordMessage(null);

    if (newPassword.length < 8) {
      setPasswordMessage({
        type: "error",
        text: "Password must be at least 8 characters long.",
      });
      setPasswordSaving(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage({
        type: "error",
        text: "Passwords do not match.",
      });
      setPasswordSaving(false);
      return;
    }

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setPasswordMessage({
          type: "error",
          text: error.message || "Failed to update password.",
        });
      } else {
        setPasswordMessage({
          type: "success",
          text: "Password updated successfully.",
        });
        setNewPassword("");
        setConfirmPassword("");
        setIsChangingPassword(false);
      }
    } catch {
      setPasswordMessage({
        type: "error",
        text: "An unexpected error occurred. Please retry.",
      });
    } finally {
      setPasswordSaving(false);
    }
  }

  async function handleOnboardingSubmit(e: FormEvent) {
    e.preventDefault();
    setOnboardingSaving(true);
    setOnboardingError(null);

    try {
      const res = await fetch("/api/customer/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: onboardingName.trim(),
          phone: onboardingPhone.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.customer) {
        setCustomer(data.customer);
        setEditName(data.customer.name || "");
        setEditPhone(data.customer.phone || "");
        setErrorState(null);
      } else {
        setOnboardingError(data.error || "Failed to save profile. Please retry.");
      }
    } catch {
      setOnboardingError("Database service temporarily unavailable. Please retry.");
    } finally {
      setOnboardingSaving(false);
    }
  }

  async function handleConfirmCancel() {
    if (!cancellingBookingId) return;
    setIsCancellingBooking(true);

    try {
      const result = await cancelCustomerBookingAction(cancellingBookingId);
      if (result.success) {
        setCancellingBookingId(null);
        await loadBookings();
      } else {
        alert(result.error || "Unable to cancel booking.");
      }
    } catch {
      alert("Failed to cancel booking. Please contact dispatch.");
    } finally {
      setIsCancellingBooking(false);
    }
  }

  if (loading && !customer) {
    return <AccountLoadingSkeleton />;
  }

  if (errorState) {
    return (
      <AccountErrorState
        errorState={errorState}
        retrying={retrying}
        onRetry={() => loadAccountData(true)}
        onboardingName={onboardingName}
        setOnboardingName={setOnboardingName}
        onboardingPhone={onboardingPhone}
        setOnboardingPhone={setOnboardingPhone}
        onboardingSaving={onboardingSaving}
        onboardingError={onboardingError}
        onOnboardingSubmit={handleOnboardingSubmit}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 py-10 px-4 sm:px-6 lg:px-8">
      <Container>
        <div className="space-y-8">
          {/* 1. Header Profile Card */}
          {customer && (
            <AccountProfileCard
              customer={customer}
              bookings={bookings}
              emergencyRequests={emergencyRequests}
              contactInquiries={contactInquiries}
              unauthorizedAdminError={false}
              onEditProfile={() => setIsEditingProfile(true)}
            />
          )}

          {/* 2. Navigation Tabs */}
          <div className="flex border-b border-slate-700 space-x-4">
            <button
              onClick={() => switchTab("bookings")}
              className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === "bookings"
                  ? "border-blue-500 text-blue-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <CalendarDays className="w-4 h-4" />
              Bookings ({bookings.length})
            </button>
            <button
              onClick={() => switchTab("emergency")}
              className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === "emergency"
                  ? "border-amber-500 text-amber-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Siren className="w-4 h-4" />
              Emergency ({emergencyRequests.length})
            </button>
            <button
              onClick={() => switchTab("inquiries")}
              className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === "inquiries"
                  ? "border-emerald-500 text-emerald-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <Mail className="w-4 h-4" />
              Inquiries ({contactInquiries.length})
            </button>
            <button
              onClick={() => switchTab("settings")}
              className={`pb-3 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
                activeTab === "settings"
                  ? "border-purple-500 text-purple-400"
                  : "border-transparent text-slate-400 hover:text-slate-200"
              }`}
            >
              <User className="w-4 h-4" />
              Security
            </button>
          </div>

          {/* 3. Tab Contents */}
          <div className="pt-2">
            {activeTab === "bookings" && (
              <BookingHistorySection
                bookings={bookings}
                bookingsLoading={bookingsLoading}
              />
            )}

            {activeTab === "emergency" && (
              <EmergencyRequestsSection emergencyRequests={emergencyRequests} />
            )}

            {activeTab === "inquiries" && (
              <ContactInquiriesSection contactInquiries={contactInquiries} />
            )}

            {activeTab === "settings" && (
              <AccountSecuritySection
                isChangingPassword={isChangingPassword}
                setIsChangingPassword={setIsChangingPassword}
                newPassword={newPassword}
                setNewPassword={setNewPassword}
                confirmPassword={confirmPassword}
                setConfirmPassword={setConfirmPassword}
                passwordSaving={passwordSaving}
                passwordMessage={passwordMessage}
                onPasswordSubmit={handlePasswordSubmit}
              />
            )}
          </div>
        </div>

        {/* 4. Modals */}
        {reviewModalBooking && (
          <ReviewModal
            bookingId={reviewModalBooking.id}
            serviceName={reviewModalBooking.primaryService || reviewModalBooking.service?.name || "Mobile Tire Service"}
            vehicle={reviewModalBooking.vehicle || "Vehicle"}
            onClose={() => setReviewModalBooking(null)}
            onSuccess={() => {
              setReviewModalBooking(null);
              void loadBookings();
            }}
          />
        )}

        <CancelBookingModal
          isOpen={cancellingBookingId !== null}
          isCancelling={isCancellingBooking}
          onConfirm={handleConfirmCancel}
          onClose={() => setCancellingBookingId(null)}
        />
      </Container>
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={<AccountLoadingSkeleton />}>
      <AccountPageInner />
    </Suspense>
  );
}
