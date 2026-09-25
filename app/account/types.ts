export type Customer = {
  id: string;
  userId: string | null;
  name: string;
  email: string | null;
  phone: string;
  createdAt?: string;
};

export type Booking = {
  id: string;
  technicianId?: string | null;
  technician?: {
    id: string;
    name: string;
    role: string;
    phone?: string | null;
  } | null;
  arrivedAt?: string | null;
  primaryService?: string | null;
  extraServices?: Array<{ name: string; price: number }> | null;
  totalAmount?: number | string | null;
  notes?: string | null;
  vehicle: string;
  location: string;
  formattedAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  bookingDate: string;
  bookingTime: string;
  status: string;
  paymentStatus?: string;
  depositPaid?: number | string;
  balanceAmount?: number | string;
  tireSize?: string | null;
  message: string | null;
  bookedAt?: string;
  etaMinutes?: number | null;
  estimatedArrivalAt?: string | null;
  arrivalStatus?: string;
  reviews?: {
    id: string;
    rating: number;
    isApproved: boolean;
  }[];
  service: {
    name: string;
  } | null;
};

export type EmergencyRequest = {
  id: string;
  currentLocation: string;
  formattedAddress?: string | null;
  problem: string;
  problemDetails: string | null;
  vehicle: string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  service: {
    name: string;
  } | null;
  dispatcherUpdates?: Array<{
    id: string;
    subject: string | null;
    body: string;
    createdAt: string;
    channel: string;
    status: string;
  }>;
};

export type ContactInquiry = {
  id: string;
  name: string;
  email: string | null;
  phone: string;
  service: string | null;
  location: string | null;
  emergency: boolean;
  message: string;
  status: string;
  createdAt: string;
  dispatcherResponses: Array<{
    id: string;
    subject: string | null;
    body: string;
    createdAt: string;
    channel: string;
    status: string;
  }>;
};

export type ErrorState = {
  type: "unauthorized" | "not_found" | "server_error" | "admin_access" | null;
  message: string;
};
