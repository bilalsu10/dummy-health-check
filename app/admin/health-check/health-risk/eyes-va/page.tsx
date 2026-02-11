import TestResultPage from "@/components/admin/health-risk/TestResultPage";

export default function Page() {
  return (
    <TestResultPage
      title="VA"
      testKey="VA"
      fallbackKeys={["ตรวจการมองเห็นระยะไกล"]}
      backLabel="Health Risk"
    />
  );
}
