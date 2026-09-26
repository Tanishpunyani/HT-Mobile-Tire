"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type ServiceHistory = {
  service: string;
  vehicle: string;
  date: string;
  status: string;
};

type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  bookings: number;
  serviceHistory: ServiceHistory[];
};

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadCustomers() {
    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/admin/customers");
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Unable to load customers.");
      }

      setCustomers(data.customers || []);
    } catch (error) {
      console.error(error);
      setError("Unable to load customers.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString();
  }

  function formatStatus(status: string) {
    return status.replace("_", " ");
  }

  return (
    <div className="min-h-screen bg-background-light py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-primary">
              Admin
            </p>

            <h1 className="mt-2 text-3xl font-extrabold text-foreground sm:text-4xl">
              Customer Management
            </h1>

            <p className="mt-3 text-text-secondary">
              View customers, bookings, and service history.
            </p>
          </div>

          <Link
            href="/admin/dashboard"
            className="inline-flex w-fit items-center rounded-[10px] border border-border bg-white px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-gray-50"
          >
            Back to Dashboard
          </Link>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-8 rounded-[12px] border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="mt-8 rounded-[16px] border border-border bg-white p-10 text-center shadow-sm">
            <p className="text-text-secondary">
              Loading customers...
            </p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && customers.length === 0 && (
          <div className="mt-8 rounded-[16px] border border-border bg-white p-12 text-center shadow-sm">
            <h2 className="text-xl font-bold text-foreground">
              No customers yet
            </h2>

            <p className="mt-2 text-text-secondary">
              Customers will appear here after they make a booking.
            </p>
          </div>
        )}

        {/* Customer table */}
        {!loading && !error && customers.length > 0 && (
          <div className="mt-8 overflow-hidden rounded-[16px] border border-border bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-[1100px] w-full text-left">
                <thead className="border-b border-border bg-gray-50">
                  <tr>
                    <th className="px-5 py-4 text-sm font-bold text-foreground">
                      Customer
                    </th>

                    <th className="px-5 py-4 text-sm font-bold text-foreground">
                      Phone
                    </th>

                    <th className="px-5 py-4 text-sm font-bold text-foreground">
                      Email
                    </th>

                    <th className="px-5 py-4 text-sm font-bold text-foreground">
                      Bookings
                    </th>

                    <th className="px-5 py-4 text-sm font-bold text-foreground">
                      Service History
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {customers.map((customer) => (
                    <tr
                      key={customer.id}
                      className="border-b border-border last:border-b-0"
                    >
                      <td className="px-5 py-5 text-sm font-semibold text-foreground">
                        {customer.name}
                      </td>

                      <td className="px-5 py-5 text-sm text-text-secondary">
                        {customer.phone}
                      </td>

                      <td className="px-5 py-5 text-sm text-text-secondary">
                        {customer.email || "N/A"}
                      </td>

                      <td className="px-5 py-5 text-sm font-bold text-foreground">
                        {customer.bookings}
                      </td>

                      <td className="px-5 py-5">
                        {customer.serviceHistory.length === 0 ? (
                          <span className="text-sm text-text-secondary">
                            No service history
                          </span>
                        ) : (
                          <div className="space-y-3">
                            {customer.serviceHistory.map(
                              (history, index) => (
                                <div
                                  key={`${customer.id}-${index}`}
                                  className="rounded-[10px] border border-border bg-gray-50 p-3"
                                >
                                  <p className="text-sm font-semibold capitalize text-foreground">
                                    {history.service}
                                  </p>

                                  <p className="mt-1 text-xs text-text-secondary">
                                    {history.vehicle} •{" "}
                                    {formatDate(history.date)}
                                  </p>

                                  <p className="mt-1 text-xs font-semibold capitalize text-primary">
                                    {formatStatus(history.status)}
                                  </p>
                                </div>
                              )
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}