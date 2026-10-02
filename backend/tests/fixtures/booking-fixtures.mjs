/**
 * Deterministic Booking Test Fixtures
 */

export const mockBookingAlicePending = {
  id: "book_alice_pending_101",
  customerId: "cust_alice_111",
  technicianId: null,
  status: "pending",
  paymentStatus: "pending",
  serviceType: "Flat Tire Repair",
  scheduledDate: "2026-10-15",
  scheduledTime: "09:00 AM",
  address: "123 Main St, Dallas, TX 75201",
  latitude: 32.7767,
  longitude: -96.797,
  vehicleDetails: {
    year: "2022",
    make: "Toyota",
    model: "Camry",
    tireSize: "215/55R17",
  },
  price: 85.0,
  createdAt: new Date("2026-10-01T10:00:00.000Z"),
};

export const mockBookingAliceConfirmed = {
  id: "book_alice_confirmed_102",
  customerId: "cust_alice_111",
  technicianId: "tech_carlos_333",
  status: "confirmed",
  paymentStatus: "pending",
  serviceType: "New Tire Installation",
  scheduledDate: "2026-10-15",
  scheduledTime: "11:00 AM",
  address: "123 Main St, Dallas, TX 75201",
  latitude: 32.7767,
  longitude: -96.797,
  price: 180.0,
  createdAt: new Date("2026-10-01T11:00:00.000Z"),
};

export const mockBookingBobInProgress = {
  id: "book_bob_inprogress_201",
  customerId: "cust_bob_222",
  technicianId: "tech_david_444",
  status: "in_progress",
  paymentStatus: "quote_sent",
  serviceType: "Wheel Balancing & Rotation",
  scheduledDate: "2026-10-15",
  scheduledTime: "02:00 PM",
  address: "456 Oak Ave, Fort Worth, TX 76102",
  latitude: 32.7555,
  longitude: -97.3308,
  price: 120.0,
  createdAt: new Date("2026-10-01T12:00:00.000Z"),
};

export const mockBookingCompleted = {
  id: "book_completed_301",
  customerId: "cust_alice_111",
  technicianId: "tech_carlos_333",
  status: "completed",
  paymentStatus: "paid",
  serviceType: "Emergency Roadside Tire Change",
  scheduledDate: "2026-09-10",
  scheduledTime: "08:00 AM",
  address: "789 Elm St, Plano, TX 75024",
  latitude: 33.0198,
  longitude: -96.6989,
  price: 150.0,
  extraCharges: 25.0,
  totalPrice: 175.0,
  createdAt: new Date("2026-09-10T08:00:00.000Z"),
};
