"use client";

import { useRef, type FormEvent } from "react";
import { User, X, Loader2, AlertCircle } from "lucide-react";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";

interface EditProfileModalProps {
  isOpen: boolean;
  name: string;
  phone: string;
  email: string | null;
  saving: boolean;
  error: string | null;
  onNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onSubmit: (e: FormEvent) => Promise<void>;
  onClose: () => void;
}

export default function EditProfileModal({
  isOpen,
  name,
  phone,
  email,
  saving,
  error,
  onNameChange,
  onPhoneChange,
  onSubmit,
  onClose,
}: EditProfileModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, {
    isOpen,
    onClose: saving ? undefined : onClose,
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-profile-title"
        className="relative w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-2xl sm:p-8"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          aria-label="Close dialog"
          className="absolute right-5 top-5 rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-foreground disabled:opacity-50"
        >
          <X size={20} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <User size={24} />
          </div>
          <div>
            <h2 id="edit-profile-title" className="text-xl font-bold text-foreground">
              Edit Profile
            </h2>
            <p className="text-xs text-text-secondary">
              Update your contact details for technician dispatch.
            </p>
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="editName" className="block text-xs font-bold text-foreground mb-1.5">
              Full Name
            </label>
            <input
              id="editName"
              type="text"
              required
              disabled={saving}
              placeholder="e.g. John Smith"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
              className="w-full rounded-xl border border-border bg-slate-50/50 p-3 text-xs text-foreground outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10 disabled:opacity-50"
            />
          </div>

          <div>
            <label htmlFor="editPhone" className="block text-xs font-bold text-foreground mb-1.5">
              Mobile Phone
            </label>
            <input
              id="editPhone"
              type="tel"
              required
              disabled={saving}
              placeholder="(555) 000-0000"
              value={phone}
              onChange={(e) => onPhoneChange(e.target.value)}
              className="w-full rounded-xl border border-border bg-slate-50/50 p-3 text-xs text-foreground outline-none transition focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10 disabled:opacity-50"
            />
            <p className="mt-1 text-[11px] text-text-secondary">
              Used for live tracking notifications and technician arrival updates.
            </p>
          </div>

          <div>
            <label htmlFor="editEmail" className="block text-xs font-bold text-foreground mb-1.5">
              Email Address
            </label>
            <input
              id="editEmail"
              type="email"
              disabled
              value={email || "No email linked"}
              className="w-full rounded-xl border border-border bg-slate-100 p-3 text-xs text-slate-500 cursor-not-allowed outline-none select-none"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              Email address is linked to your account login and cannot be modified.
            </p>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-border px-4 py-2.5 text-xs font-bold text-text-secondary transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-primary/20 transition hover:bg-primary-hover disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
