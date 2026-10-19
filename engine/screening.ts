import { NUTRITION as N } from "../config/nutrition.ts";

export type ScreeningAnswers = {
  age: number;
  weightKg: number;
  heightCm: number;
  pregnantOrBreastfeeding: boolean;
  eatingDisorderNowOrPast: boolean;
  diabetesOrGlucoseMedication: boolean;
  otherConditionNeedingSupervisedDiet: boolean;
};

export const DECLINE_MESSAGE =
  "Pal can't build a weight-loss plan for you. Please talk to your doctor or a registered dietitian, who can make a plan that's safe for you.";

// Returns only eligible true/false. The reasons are never returned, so they can't be stored.
export function screen(a: ScreeningAnswers): { eligible: boolean } {
  const bmi = a.weightKg / (a.heightCm / 100) ** 2;
  const eligible =
    a.age >= N.minAge.value &&
    bmi >= N.minBmi.value &&
    !a.pregnantOrBreastfeeding &&
    !a.eatingDisorderNowOrPast &&
    !a.diabetesOrGlucoseMedication &&
    !a.otherConditionNeedingSupervisedDiet;
  return { eligible };
}
