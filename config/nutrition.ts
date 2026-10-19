// Every number Pal plans with lives here, each tagged with an evidence/pack.json id.
// Changing a value? Update the source id too, and have the dietitian re-check.

export type Sourced<T> = { value: T; source: string };

export const NUTRITION = {
  // Mifflin-St Jeor: 10 x kg + 6.25 x cm - 5 x age + s, where s = +5 (men) or -161 (women)
  mifflinSexConstant: { value: { male: 5, female: -161 }, source: "mifflin-1990" },
  activityFactor: {
    value: { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 },
    source: "activity-factors",
  },
  defaultDeficitKcal: { value: 500, source: "harvard-deficit" },
  maxLossLbPerWeek: { value: 2, source: "harvard-deficit" },
  kcalPerLb: { value: 3500, source: "harvard-deficit" }, // rule of thumb, not exact
  calorieFloor: { value: { male: 1500, female: 1200 }, source: "harvard-deficit" },
  proteinGPerKg: { value: 1.6, source: "issn-protein-2017" }, // design choice inside 1.4 to 2.0
  proteinRangeGPerKg: { value: [1.4, 2.0] as const, source: "issn-protein-2017" },
  proteinPerMealGPerKg: { value: 0.25, source: "issn-protein-2017" },
  minBmi: { value: 18.5, source: "who-bmi" },
  minAge: { value: 18, source: "harvard-deficit" }, // product rule: adults only
} satisfies Record<string, Sourced<unknown>>;

// Gate C pass test tolerances (BUILD_PLAN.md §3), product rules rather than health claims.
export const TOLERANCE = { calorieShare: 0.05, proteinShortfallShare: 0.1 };
