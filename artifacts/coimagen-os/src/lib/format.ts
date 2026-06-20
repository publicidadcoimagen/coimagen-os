import { format } from "date-fns";

export function formatDate(dateStr?: string | null) {
  if (!dateStr) return "-";
  try {
    return format(new Date(dateStr), "MMM d, yyyy");
  } catch (e) {
    return dateStr;
  }
}

export function formatCurrency(amount?: number | null) {
  if (amount == null) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}
