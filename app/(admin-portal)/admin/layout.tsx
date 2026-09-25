import AdminNavbar from "./components/AdminNavbar";
import { requireAdminSession } from "@/lib/admin-auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireAdminSession();

  return (
    <div className="min-h-screen bg-background-light">
      <AdminNavbar />
      {children}
    </div>
  );
}
