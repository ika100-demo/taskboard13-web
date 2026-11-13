export const TITLE_MAX = 200;
export const TITLE_REQUIRED = "Enter a title.";
export const TITLE_TOO_LONG = "The title can have at most 200 characters.";
export const TITLE_REJECTED = "The title was not accepted. Please check it.";
export const LOAD_FAILED = "Tasks could not be loaded. Please try again.";
export const SAVE_FAILED = "The task could not be saved. Please try again.";
export const NO_TASKS = "No tasks yet";
export const NO_DUE_DATE = "No due date";

/** null when valid; TITLE_REQUIRED when empty or whitespace-only; TITLE_TOO_LONG when over 200 code points. */
export function validateTitle(title: string): string | null {
  if (title.trim() === "") return TITLE_REQUIRED;
  if (Array.from(title).length > TITLE_MAX) return TITLE_TOO_LONG;
  return null;
}

/** true for a "YYYY-MM-DD" string. */
export function isDueDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
