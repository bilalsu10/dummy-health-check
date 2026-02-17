import TestResultPage from "@/components/admin/health-risk/TestResultPage";

export default function Page() {
  return (
    <TestResultPage
      title="Blood Pressure"
      testKey="Blood Pressure"
      fallbackKeys={["ความดันโลหิต"]}
      backLabel="Health Risk"
    />
  );
}
