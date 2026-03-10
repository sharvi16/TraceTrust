import { useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import ImpactRing from './ImpactRing';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

const CATEGORY_COLORS = {
  education: '#3b82f6',
  health: '#10b981',
  food: '#f59e0b',
  disaster: '#ef4444',
};

export default function NGOCard({ ngo }) {
  const [expanded, setExpanded] = useState(false);

  const {
    ngo_name,
    category,
    impact_score = 0,
    grade = 'N/A',
    total_donated = 0,
    by_category = {},
  } = ngo;

  const chartData = {
    labels: Object.keys(by_category).map((k) => k.charAt(0).toUpperCase() + k.slice(1)),
    datasets: [
      {
        data: Object.values(by_category),
        backgroundColor: Object.keys(by_category).map(
          (k) => CATEGORY_COLORS[k] ?? '#6b7280'
        ),
        borderRadius: 4,
      },
    ],
  };

  const chartOptions = {
    indexAxis: 'y',
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { callback: (v) => `₹${(v / 1000).toFixed(0)}k` } },
      y: { ticks: { font: { size: 12 } } },
    },
  };

  return (
    <div className="bg-white rounded-2xl shadow hover:shadow-md transition overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          {/* Details */}
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-[#1a3a5c] text-lg truncate">{ngo_name}</h3>
            <span
              className="inline-block mt-1 px-2 py-0.5 text-xs font-semibold rounded-full capitalize"
              style={{ backgroundColor: `${CATEGORY_COLORS[category] ?? '#6b7280'}22`, color: CATEGORY_COLORS[category] ?? '#6b7280' }}
            >
              {category}
            </span>
            <p className="text-sm text-gray-500 mt-3">
              Total Donated:{' '}
              <span className="font-semibold text-gray-800">
                ₹{total_donated.toLocaleString('en-IN')}
              </span>
            </p>
          </div>
          {/* Score ring */}
          <ImpactRing score={impact_score} grade={grade} size="sm" />
        </div>

        <button
          onClick={() => setExpanded((v) => !v)}
          className="mt-4 w-full text-sm font-medium text-[#10b981] hover:text-[#0d9668] flex items-center justify-center gap-1"
        >
          {expanded ? 'Hide Details ▲' : 'View Details ▼'}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-5 pb-5 pt-4">
          {Object.keys(by_category).length > 0 ? (
            <>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Expense Breakdown</p>
              <Bar data={chartData} options={chartOptions} height={120} />
            </>
          ) : (
            <p className="text-sm text-gray-400 text-center py-4">No expense data yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
