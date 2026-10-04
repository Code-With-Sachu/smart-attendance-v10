export const PRESET_COLORS = [
  "#6366F1", // indigo
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#EF4444", // red
  "#F97316", // orange
  "#EAB308", // amber
  "#22C55E", // green
  "#14B8A6", // teal
  "#0EA5E9", // sky
  "#3B82F6", // blue
  "#64748B", // slate
  "#0F172A", // ink
] as const;

export function nextPresetColor(index: number) {
  return PRESET_COLORS[index % PRESET_COLORS.length];
}
