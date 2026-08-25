import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Filler,
} from 'chart.js'
import { Line } from 'react-chartjs-2'
import { ASSETS } from './shared/assets'
import type { AssetMarketData } from './types'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler)

type Props = {
  assets: AssetMarketData[]
  visible: string[]
}

export function PerformanceChart({ assets, visible }: Props) {
  const labels = assets[0]?.points.map((point) => point.date) ?? []
  const datasets = assets
    .filter((asset) => visible.includes(asset.ticker))
    .map((asset) => {
      const meta = ASSETS.find((candidate) => candidate.ticker === asset.ticker)!
      const values = new Map(asset.points.map((point) => [point.date, point.normalized]))
      return {
        label: meta.shortTicker,
        data: labels.map((label) => values.get(label) ?? null),
        borderColor: meta.color,
        backgroundColor: 'transparent',
        borderWidth: 2.25,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.22,
        spanGaps: true,
      }
    })

  return (
    <Line
      data={{ labels, datasets }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#12242b',
            titleColor: '#ffffff',
            bodyColor: '#dbe6e8',
            padding: 12,
            displayColors: true,
            callbacks: {
              title: (items) => new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${items[0].label}T12:00:00`)),
              label: (item) => ` ${item.dataset.label}: ${(item.parsed.y ?? 0).toFixed(2)}%`,
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              color: '#788287',
              maxTicksLimit: 7,
              maxRotation: 0,
              callback: (_value, index) => new Intl.DateTimeFormat('pl-PL', { month: 'short' }).format(new Date(`${labels[index]}T12:00:00`)),
            },
          },
          y: {
            position: 'right',
            border: { display: false },
            grid: { color: 'rgba(18, 36, 43, .08)' },
            ticks: { color: '#788287', callback: (value) => `${value}%` },
          },
        },
      }}
    />
  )
}
