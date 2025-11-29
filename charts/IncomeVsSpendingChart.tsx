"use client";

import React, { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { safeCurrency } from "@/lib/utils/currency";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler, Legend);

type Point = { label: string; income: number; spending: number; };

interface Props {
  data: Point[];
  currency?: string;
}

export function IncomeVsSpendingChart({ data, currency }: Props) {
  const cur = safeCurrency(currency);
  const chartData = useMemo(() => {
    const labels = data.map((d) => d.label);
    return {
      labels,
      datasets: [
        {
          label: "Income",
          data: data.map((d) => d.income),
          borderColor: "#3dd598",
          backgroundColor: "rgba(61, 213, 152, 0.18)",
          tension: 0.35,
          fill: true,
          pointRadius: 3,
          pointBackgroundColor: "#3dd598",
        },
        {
          label: "Spending",
          data: data.map((d) => d.spending),
          borderColor: "#ff6b6b",
          backgroundColor: "rgba(255, 107, 107, 0.14)",
          tension: 0.35,
          fill: true,
          pointRadius: 3,
          pointBackgroundColor: "#ff6b6b",
        },
      ],
    };
  }, [data]);

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: "top" as const,
        labels: { color: "#9ba1ae" },
      },
      tooltip: {
        backgroundColor: "#1b1b1f",
        borderColor: "rgba(255,255,255,0.08)",
        borderWidth: 1,
        callbacks: {
          label: (ctx: any) =>
            `${ctx.dataset.label}: ${new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: cur,
              maximumFractionDigits: 0,
            }).format(ctx.parsed.y ?? 0)}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: "#9ba1ae" },
      },
      y: {
        grid: { color: "rgba(255,255,255,0.06)" },
        ticks: { color: "#9ba1ae" },
      },
    },
  };

  return <Line data={chartData} options={options} className="w-full" />;
}
