import TestResultPage from "@/components/admin/health-risk/TestResultPage";

export default function Page() {
  return (
    <TestResultPage
      title="Urine Arsenic"
      testKey="Urine Arsenic"
      fallbackKeys={["ตรวจสารหนูในปัสสาวะ"]}
      backLabel="Health Risk"
    />
  );
}
