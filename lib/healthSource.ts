export type RiskLevel = "Low" | "Medium" | "High";

export const mockHealthRecords = [
  { risk: "Low" as RiskLevel },
  { risk: "Medium" as RiskLevel },
  { risk: "High" as RiskLevel },
  { risk: "Medium" as RiskLevel },
];

export function getRiskSummary() {
  return mockHealthRecords.reduce(
    (acc, r) => {
      acc[r.risk]++;
      return acc;
    },
    { Low: 0, Medium: 0, High: 0 }
  );
}
