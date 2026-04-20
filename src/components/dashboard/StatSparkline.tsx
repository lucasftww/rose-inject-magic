import { useMemo } from "react";

export default function StatSparkline({
  data,
  color,
  gradientId,
}: {
  data: { v: number }[];
  color: string;
  gradientId: string;
}) {
  const points = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) return "";
    if (data.length === 1) return `0,16 100,16`;
    const values = data.map((d) => Number(d.v) || 0);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = Math.max(1e-9, max - min);
    return values
      .map((v, i) => {
        const x = (i / (values.length - 1)) * 100;
        const y = 2 + (1 - (v - min) / span) * 30;
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");
  }, [data]);

  const areaPath = useMemo(() => {
    if (!points) return "";
    const first = points.split(" ")[0];
    const last = points.split(" ").at(-1);
    if (!first || !last) return "";
    const [fx] = first.split(",");
    const [lx] = last.split(",");
    return `M ${fx},32 L ${points.replaceAll(" ", " L ")} L ${lx},32 Z`;
  }, [points]);

  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" width="100%" height="100%" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.9} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      {areaPath ? <path d={areaPath} fill={`url(#${gradientId})`} /> : null}
      {points ? (
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={1.8}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ) : null}
    </svg>
  );
}
