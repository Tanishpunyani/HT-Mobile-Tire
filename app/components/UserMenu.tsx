"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { User, CalendarCheck, Siren, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";

type UserMenuProps = {
  onItemClick?: () => void;
};

export default function UserMenu({ onItemClick }: UserMenuProps) {
  const { user, loading, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  const userData = user
    ? {
        name: user.user_metadata?.full_name || user.user_metadata?.name || "",
        email: user.email || "",
      }
    : null;

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  async function handleSignOut() {
    setIsOpen(false);
    if (onItemClick) onItemClick();
    await signOut();
  }

  const initials = userData?.name
    ? userData.name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : userData?.email
      ? userData.email[0].toUpperCase()
      : "U";

  return (
    <div className="relative inline-block" ref={menuRef}>
      {/* Circular User Avatar Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-primary p-2 text-white shadow-sm transition-all hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary/40"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-label="User Account Menu"
      >
        {loading ? (
          <User size={18} />
        ) : initials ? (
          <span className="text-xs font-black tracking-tight">{initials}</span>
        ) : (
          <User size={18} />
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 origin-top-right rounded-lg border border-border bg-white dark:bg-gray-800 p-1.5 shadow-lg z-50 animate-in fade-in zoom-in-95 duration-150">
          {userData?.email && (
            <div className="px-3 py-2 border-b border-border/60">
              <p className="truncate text-xs font-bold text-gray-900 dark:text-gray-100">
                {userData.name || "Customer"}
              </p>
              <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
                {userData.email}
              </p>
            </div>
          )}

          <div className="py-1">
            <Link
              href="/account"
              onClick={() => {
                setIsOpen(false);
                if (onItemClick) onItemClick();
              }}
              className="flex items-center gap-2.5 rounded-md px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <User size={15} className="text-primary" />
              <span>My Account</span>
            </Link>

            <Link
              href="/account?tab=bookings"
              onClick={() => {
                setIsOpen(false);
                if (onItemClick) onItemClick();
              }}
              className="flex items-center gap-2.5 rounded-md px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <CalendarCheck size={15} className="text-primary" />
              <span>My Bookings</span>
            </Link>

            <Link
              href="/account?tab=emergency"
              onClick={() => {
                setIsOpen(false);
                if (onItemClick) onItemClick();
              }}
              className="flex items-center gap-2.5 rounded-md px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <Siren size={15} className="text-primary" />
              <span>Emergency Requests</span>
            </Link>
          </div>

          {/* Divider & Sign Out */}
          <div className="border-t border-border/60 pt-1">
            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
            >
              <LogOut size={15} />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
