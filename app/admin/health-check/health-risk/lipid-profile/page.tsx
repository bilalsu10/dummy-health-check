import TestResultPage from "@/components/admin/health-risk/TestResultPage";

export default function Page() {
  return (
    <TestResultPage
      title="Lipid Profile"
      testKey="Lipid Profile"
      fallbackKeys={["Lipid profile", "ไขมัน+น้ำตาล", "ไขมัน+น้ำตาลในเลือด", "ไขมันและน้ำตาลในเลือด"]}
      backLabel="Health Risk"
    />
  );
}
