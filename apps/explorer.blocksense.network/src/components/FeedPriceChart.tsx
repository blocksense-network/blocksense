'use client';

import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
);

type DataPoint = { timestamp: number; value: number };

type FeedPriceChartProps = {
  points: Array<DataPoint>;
};

export function FeedPriceChart({ points }: FeedPriceChartProps) {
  const data = {
    labels: points.map(p => new Date(p.timestamp).toLocaleTimeString()),
    datasets: [
      {
        label: 'Price',
        data: points.map(p => p.value),
        borderColor: '#EEFF00',
        backgroundColor: '#EEFF00',
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { display: true, title: { display: true, text: 'Time' } },
      y: { display: true, title: { display: true, text: 'Value' } },
    },
  };

  return (
    <section className="w-full h-full">
      <Line data={data} options={options} />
    </section>
  );
}
