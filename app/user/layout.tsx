// ตัวอย่าง layout.tsx (ใช้ได้กับ public / user / admin)
export default function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
    </>
  );
}
