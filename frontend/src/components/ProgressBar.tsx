import React from "react";

type ProgressBarProps = {
  value: number;
};

export default function ProgressBar({ value }: ProgressBarProps): JSX.Element {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="progress">
      <div className="progress-fill" style={{ width: `${clamped}%` }} />
      <span className="progress-label">{clamped}%</span>
    </div>
  );
}
