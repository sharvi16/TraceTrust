import { useState } from 'react';

export default function AnomalyBanner({ reasons = [] }) {
  const [visible, setVisible] = useState(true);

  if (!visible || reasons.length === 0) return null;

  return (
    <div className="bg-red-50 border border-red-300 rounded-xl p-4 relative">
      <button
        onClick={() => setVisible(false)}
        className="absolute top-3 right-3 text-red-400 hover:text-red-600 text-lg leading-none"
        aria-label="Dismiss"
      >
        &times;
      </button>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">&#9888;&#xFE0F;</span>
        <h4 className="font-bold text-red-700 text-sm">Anomaly Detected</h4>
      </div>
      <ul className="list-disc list-inside space-y-1">
        {reasons.map((r, i) => (
          <li key={i} className="text-red-700 text-sm">{r}</li>
        ))}
      </ul>
    </div>
  );
}
