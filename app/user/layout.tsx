// app/user/layout.tsx
import UserHeader from "@/components/layout/UserHeader";
import BackButton from "@/components/navigation/BackButton";

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <UserHeader />
      <div className="relative mx-auto max-w-6xl px-6 h-0">
        <BackButton />
      </div>
      <main >{children}</main>
    </>
  );
} 