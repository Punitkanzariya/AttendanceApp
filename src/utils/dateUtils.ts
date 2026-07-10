import type { LeaveDurationType, HalfDayPeriod } from "@/types";

export function formatDateDDMMYYYY(dateInput: Date | string | number | null | undefined): string {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  
  return `${day}-${month}-${year}`;
}

export function formatLeaveDurationText(
  startDate: string,
  endDate: string,
  totalDays: number,
  durationType?: LeaveDurationType,
  halfDayPeriod?: HalfDayPeriod
): string {
  const formattedStart = formatDateDDMMYYYY(startDate);
  const formattedEnd = formatDateDDMMYYYY(endDate);
  
  if (durationType === "half_day") {
    const period = halfDayPeriod === "second_half" ? "Second Half" : "First Half";
    return `${formattedStart} (Half Day - ${period})`;
  } else if (durationType === "single_day") {
    return `${formattedStart} (1 Day)`;
  } else {
    if (startDate === endDate) {
      return `${formattedStart} (1 Day)`;
    }
    return `${formattedStart} to ${formattedEnd} (${totalDays} Days)`;
  }
}
