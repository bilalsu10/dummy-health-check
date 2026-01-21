// app/admin/layout.tsx
import AdminHeader from "@/components/layout/AdminHeader";
import BackButton from "@/components/navigation/BackButton";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AdminHeader />
      <div className="relative mx-auto max-w-6xl px-6 h-0">
        <BackButton />
      </div>
      <main>{children}</main>
    </>
  );
} 