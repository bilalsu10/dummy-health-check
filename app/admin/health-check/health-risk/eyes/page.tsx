import TestResultPage from "@/components/admin/health-risk/TestResultPage";

export default function Page() {
  return (
    <TestResultPage
      title="Occupational Vision Exam"
      testKey="Occupational Vision Exam"
      fallbackKeys={["ตรวจสายตาทางอาชีวอนามัย"]}
      backLabel="Health Risk"
    />
  );
}
