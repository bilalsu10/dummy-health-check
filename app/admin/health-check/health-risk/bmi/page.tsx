import TestResultPage from "@/components/admin/health-risk/TestResultPage";

export default function Page() {
  return (
    <TestResultPage
      title="BMI"
      testKey="BMI"
      fallbackKeys={["ดัชนีมวลกาย"]}
      backLabel="Health Risk"
    />
  );
}
