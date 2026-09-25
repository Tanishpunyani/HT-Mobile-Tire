/**
 * Deterministic Test Fixtures for Users, Technicians, and Admin
 */

export const mockCustomerAlice = {
  id: "cust_alice_111",
  authUserId: "auth_alice_111",
  email: "alice@example.com",
  name: "Alice Smith",
  phone: "2145550101",
  role: "customer",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

export const mockCustomerBob = {
  id: "cust_bob_222",
  authUserId: "auth_bob_222",
  email: "bob@example.com",
  name: "Bob Jones",
  phone: "2145550202",
  role: "customer",
  createdAt: new Date("2026-01-02T00:00:00.000Z"),
};

export const mockTechnicianCarlos = {
  id: "tech_carlos_333",
  name: "Carlos Rivera",
  phone: "2145550303",
  email: "carlos@htmobileservices.com",
  role: "technician",
  active: true,
};

export const mockTechnicianDavid = {
  id: "tech_david_444",
  name: "David Miller",
  phone: "2145550404",
  email: "david@htmobileservices.com",
  role: "technician",
  active: true,
};

export const mockAdminUser = {
  id: "admin_master_999",
  email: "admin@htmobileservices.com",
  role: "admin",
  username: "admin",
};
