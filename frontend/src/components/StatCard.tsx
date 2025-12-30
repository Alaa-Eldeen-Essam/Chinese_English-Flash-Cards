import React from "react";

type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
};

export default function StatCard({ label, value, hint }: StatCardProps): JSX.Element {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}
