import { NUTRITION as N } from "../config/nutrition.ts";

export type Sex = "male" | "female";
export type Activity = keyof typeof N.activityFactor.value;
export type Body = { sex: Sex; age: number; weightKg: number; heightCm: number; activity: Activity };

export type Targets = {
  restingKcal: number;
  maintenanceKcal: number;
  calories: number;
  proteinG: number;
  proteinPerMealG: number;
  floorApplied: boolean;
};

export function restingKcal(b: Body): number {
  return 10 * b.weightKg + 6.25 * b.heightCm - 5 * b.age + N.mifflinSexConstant.value[b.sex];
}

// lossLbPerWeek defaults to the 500 kcal/day deficit (about 1 lb a week) and is capped at the safe maximum.
export function computeTargets(b: Body, lossLbPerWeek?: number): Targets {
  if (b.age < N.minAge.value) throw new Error("Pal plans are for adults only");
  const resting = restingKcal(b);
  const maintenance = resting * N.activityFactor.value[b.activity];
  const maxDeficit = (N.maxLossLbPerWeek.value * N.kcalPerLb.value) / 7;
  const deficit = lossLbPerWeek === undefined
    ? N.defaultDeficitKcal.value
    : Math.min(Math.max(lossLbPerWeek, 0) * N.kcalPerLb.value / 7, maxDeficit);
  const floor = N.calorieFloor.value[b.sex];
  const wanted = maintenance - deficit;
  return {
    restingKcal: Math.round(resting),
    maintenanceKcal: Math.round(maintenance),
    calories: Math.round(Math.max(wanted, floor)),
    proteinG: Math.round(b.weightKg * N.proteinGPerKg.value),
    proteinPerMealG: Math.round(b.weightKg * N.proteinPerMealGPerKg.value),
    floorApplied: wanted < floor,
  };
}
