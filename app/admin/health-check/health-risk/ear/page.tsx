import TestResultPage from "@/components/admin/health-risk/TestResultPage";

export default function Page() {
  return (
    <TestResultPage
      title="Hearing Test"
      testKey="Hearing Test"
      fallbackKeys={["ตรวจสมรรถภาพการได้ยิน"]}
      backLabel="Health Risk"
    />
  );
}
