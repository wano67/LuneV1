"use client";

import React, { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

interface Props {
  quoteCount: number;
  acceptedCount: number;
  conversionRate: number;
}

export function BusinessPipelineChart({
  quoteCount,
  acceptedCount,
  conversionRate,
}: Props) {
  const data = useMemo(
    () => ({
      labels: ["Quoted", "Accepted"],
      datasets: [
        {
          label: "Deals",
          data: [quoteCount, acceptedCount],
          backgroundColor: ["rgba(110, 231, 255, 0.45)", "rgba(61, 213, 152, 0.55)"],
          borderColor: ["#6ee7ff", "#3dd598"],
          borderWidth: 1.5,
          borderRadius: 10,
        },
      ],
    }),
    [quoteCount, acceptedCount]
  );

  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#1b1b1f",
        borderColor: "rgba(255,255,255,0.08)",
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: "#9ba1ae" },
      },
      y: {
        grid: { color: "rgba(255,255,255,0.06)" },
        ticks: { color: "#9ba1ae", precision: 0 },
      },
    },
  };

  return (
    <div className="h-full flex flex-col justify-between">
      <Bar data={data} options={options} className="w-full" />
      <div className="mt-4 text-xs text-textMuted">
        Conversion rate:{" "}
        <span className="font-semibold text-success">
          {conversionRate.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}
