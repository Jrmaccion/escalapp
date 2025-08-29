import { redirect } from "next/navigation";

export default function AdminDashboardAlias() {
  // Alias: /admin/dashboard -> /admin
  redirect("/admin");
}
