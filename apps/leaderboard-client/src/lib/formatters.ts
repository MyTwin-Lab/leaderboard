export function formatCP(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercentage(value: number): string {
  const clamped = Math.max(0, Math.min(1, value));
  return new Intl.NumberFormat("fr-FR", {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(clamped);
}
