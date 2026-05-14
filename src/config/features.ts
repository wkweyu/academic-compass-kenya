// Feature flags — toggle module visibility without code changes.
// Transport/print flags control content visibility inside stable card/button shells
// to prevent layout shifts. Disable content, never remove the containing element.
export const FEATURES = {
  transport: true,   // Shows Transport card content in student overview
  print: true,       // Shows print buttons throughout
  reports: true,     // Shows export/report actions
} as const;

export type FeatureKey = keyof typeof FEATURES;
