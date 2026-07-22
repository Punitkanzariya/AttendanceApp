export const LEAVE_TYPES = {
  CASUAL: "casual",
  SICK: "sick",
  EARNED: "earned",
} as const;

export const LEAVE_TYPE_LABELS: Record<string, string> = {
  sick: "Sick Leave",
  earned: "Earned Leave",
  casual: "Casual Leave",
};
