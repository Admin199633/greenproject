import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen flex">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Header user={session.user} />
        <main className="flex-1 p-4 sm:p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
