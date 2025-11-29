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

interface ServicePoint {
  name: string;
  totalInvoiced: number;
}

interface Props {
  data: ServicePoint[];
  currency: string;
}

export function TopServicesRevenueChart({ data, currency }: Props) {
  const chartData = useMemo(
    () => ({
      labels: data.map((d) => d.name),
      datasets: [
        {
          label: "Invoiced",
          data: data.map((d) => d.totalInvoiced),
          backgroundColor: "rgba(110, 231, 255, 0.45)",
          borderColor: "#6ee7ff",
          borderWidth: 1.5,
          borderRadius: 10,
        },
      ],
    }),
    [data]
  );

  const options = {
    indexAxis: "y" as const,
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#1b1b1f",
        borderColor: "rgba(255,255,255,0.08)",
        borderWidth: 1,
        callbacks: {
          label: (ctx: any) =>
            new Intl.NumberFormat("fr-FR", {
              style: "currency",
              currency,
              maximumFractionDigits: 0,
            }).format(ctx.parsed.x ?? 0),
        },
      },
    },
    scales: {
      x: {
        grid: { color: "rgba(255,255,255,0.06)" },
        ticks: { color: "#9ba1ae" },
      },
      y: {
        grid: { display: false },
        ticks: { color: "#9ba1ae" },
      },
    },
  };

  return <Bar data={chartData} options={options} className="w-full" />;
}
