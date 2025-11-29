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

type Point = { label: string; value: number; };

interface NetWorthChartProps {
  data: Point[];
  currency?: string;
}

export function NetWorthChart({ data, currency }: NetWorthChartProps) {
  const formattedCurrency = safeCurrency(currency);

  const chartData = useMemo(() => {
    const labels = data.map((d) => d.label);
    const values = data.map((d) => d.value);
    return {
      labels,
      datasets: [
        {
          label: "Net Worth",
          data: values,
          fill: true,
          borderColor: "rgba(124, 155, 255, 1)",
          backgroundColor: (context: any) => {
            const ctx = context.chart.ctx;
            const gradient = ctx.createLinearGradient(0, 0, 0, 260);
            gradient.addColorStop(0, "rgba(124,155,255,0.25)");
            gradient.addColorStop(1, "rgba(124,155,255,0.02)");
            return gradient;
          },
          tension: 0.4,
          pointRadius: 4,
          pointBackgroundColor: "#7c9bff",
          pointBorderWidth: 0,
        },
      ],
    };
  }, [data]);

  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        enabled: true,
        backgroundColor: "#1b1b1f",
        borderColor: "rgba(255,255,255,0.08)",
        borderWidth: 1,
        callbacks: {
          label: (ctx: any) => {
            const value = ctx.parsed.y ?? 0;
            return new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: formattedCurrency,
              maximumFractionDigits: 0,
            }).format(value);
          },
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
