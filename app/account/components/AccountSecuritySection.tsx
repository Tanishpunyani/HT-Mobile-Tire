"use client";

import { type FormEvent, type Dispatch, type SetStateAction } from "react";
import { Lock, ShieldCheck, AlertCircle, Loader2 } from "lucide-react";

interface AccountSecuritySectionProps {
  isChangingPassword: boolean;
  setIsChangingPassword: Dispatch<SetStateAction<boolean>>;
  newPassword: string;
  setNewPassword: Dispatch<SetStateAction<string>>;
  confirmPassword: string;
  setConfirmPassword: Dispatch<SetStateAction<string>>;
  passwordSaving: boolean;
  passwordMessage: { type: "success" | "error"; text: string } | null;
  onPasswordSubmit: (e: FormEvent) => Promise<void>;
}

export default function AccountSecuritySection({
  isChangingPassword,
  setIsChangingPassword,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  passwordSaving,
  passwordMessage,
  onPasswordSubmit,
}: AccountSecuritySectionProps) {
  return (
    <div className="rounded-[20px] border border-border bg-white p-6 shadow-sm sm:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Security & Password</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Manage your account authentication credentials and access keys.
          </p>
        </div>
      </div>

      {passwordMessage && (
        <div
          className={`mt-4 flex items-center gap-2 rounded-xl p-3 text-xs font-semibold ${
            passwordMessage.type === "success"
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {passwordMessage.type === "success" ? (
            <ShieldCheck size={16} />
          ) : (
            <AlertCircle size={16} />
          )}
          {passwordMessage.text}
        </div>
      )}

      {!isChangingPassword ? (
        <div className="mt-6 flex items-center justify-between rounded-xl border border-border bg-background-light p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Lock size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Account Password</p>
              <p className="text-xs text-text-secondary">••••••••••••••••</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsChangingPassword(true)}
            className="rounded-lg bg-primary px-4 py-2 text-xs font-bold text-white transition hover:bg-primary-hover"
          >
            Change Password
          </button>
        </div>
      ) : (
        <form onSubmit={onPasswordSubmit} className="mt-6 space-y-4 max-w-md">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary">
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              placeholder="Minimum 8 characters"
              className="mt-1.5 w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-foreground placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-text-secondary">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              placeholder="Confirm new password"
              className="mt-1.5 w-full rounded-xl border border-border bg-white px-3.5 py-2.5 text-sm text-foreground placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={passwordSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-primary-hover disabled:opacity-50"
            >
              {passwordSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Save New Password
            </button>
            <button
              type="button"
              onClick={() => {
                setIsChangingPassword(false);
                setNewPassword("");
                setConfirmPassword("");
              }}
              className="rounded-xl border border-border px-4 py-2.5 text-xs font-bold text-text-secondary hover:bg-background-light"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
