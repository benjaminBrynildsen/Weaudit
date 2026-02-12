import type { DetectionResult } from "./detectors";

const SEVERITY_WEIGHT: Record<string, number> = { High: 3, Medium: 2, Low: 1 };
const CONFIDENCE_WEIGHT: Record<string, number> = { High: 3, Medium: 2, Low: 1 };

export function scoreAndPrioritize(findings: DetectionResult[]): DetectionResult[] {
  return [...findings]
    .sort((a, b) => {
      // Primary: monthly dollar impact (descending)
      if (b.amount !== a.amount) return b.amount - a.amount;

      // Secondary: severity
      const sevDiff = (SEVERITY_WEIGHT[b.severity] || 0) - (SEVERITY_WEIGHT[a.severity] || 0);
      if (sevDiff !== 0) return sevDiff;

      // Tertiary: confidence
      return (CONFIDENCE_WEIGHT[b.confidence] || 0) - (CONFIDENCE_WEIGHT[a.confidence] || 0);
    });
}
