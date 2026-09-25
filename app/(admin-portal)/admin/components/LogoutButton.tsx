"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    try {
      await fetch("/api/admin/logout", {
        method: "POST",
        credentials: "include",
      });
      router.push("/admin/login");
      router.refresh();
    } catch (err) {
      console.error("Logout error:", err);
      router.push("/admin/login");
    }
  }

  return (
    <button
      onClick={handleLogout}
      className="rounded-[10px] bg-primary px-5 py-3 text-sm font-bold text-white transition hover:bg-primary-hover"
    >
      Logout
    </button>
  );
}