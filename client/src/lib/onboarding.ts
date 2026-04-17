const KEY = "kinsa-onboarding-v1";

export function hasDismissedOnboarding(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(KEY) === "1";
}

export function dismissOnboarding(): void {
  window.localStorage.setItem(KEY, "1");
}

export function clearOnboardingDismiss(): void {
  window.localStorage.removeItem(KEY);
}
