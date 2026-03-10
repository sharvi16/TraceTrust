import { useEffect, useRef } from 'react';

const GRADE_COLORS = {
  A: '#10b981', // emerald
  B: '#f59e0b', // amber
  C: '#f97316', // orange
  D: '#ef4444', // red
  'N/A': '#9ca3af',
};

const SIZES = {
  sm: { r: 36, stroke: 7, box: 96, fontSize: 16, subSize: 11 },
  md: { r: 52, stroke: 9, box: 130, fontSize: 22, subSize: 13 },
  lg: { r: 70, stroke: 11, box: 170, fontSize: 30, subSize: 16 },
};

export default function ImpactRing({ score = 0, grade = 'N/A', size = 'md' }) {
  const cfg = SIZES[size] || SIZES.md;
  const circumference = 2 * Math.PI * cfg.r;
  const progress = Math.min(Math.max(score, 0), 100);
  const dashOffset = circumference - (progress / 100) * circumference;
  const color = GRADE_COLORS[grade] ?? '#9ca3af';
  const circleRef = useRef(null);

  // Animate stroke-dashoffset from full circumference to target on mount
  useEffect(() => {
    const el = circleRef.current;
    if (!el) return;
    el.style.transition = 'none';
    el.style.strokeDashoffset = circumference;
    // Trigger reflow then animate
    void el.getBoundingClientRect();
    el.style.transition = 'stroke-dashoffset 1s ease-out';
    el.style.strokeDashoffset = dashOffset;
  }, [score, circumference, dashOffset]);

  const center = cfg.box / 2;

  return (
    <svg
      width={cfg.box}
      height={cfg.box}
      viewBox={`0 0 ${cfg.box} ${cfg.box}`}
      aria-label={`Impact score ${score}, grade ${grade}`}
    >
      {/* Background track */}
      <circle
        cx={center} cy={center} r={cfg.r}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth={cfg.stroke}
      />
      {/* Progress arc */}
      <circle
        ref={circleRef}
        cx={center} cy={center} r={cfg.r}
        fill="none"
        stroke={color}
        strokeWidth={cfg.stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference}
        transform={`rotate(-90 ${center} ${center})`}
      />
      {/* Score label */}
      <text
        x={center} y={center - 4}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={cfg.fontSize}
        fontWeight="700"
        fill="#111827"
      >
        {grade === 'N/A' ? '—' : `${score}%`}
      </text>
      {/* Grade label */}
      <text
        x={center} y={center + cfg.fontSize * 0.85}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={cfg.subSize}
        fontWeight="600"
        fill={color}
      >
        Grade {grade}
      </text>
    </svg>
  );
}
