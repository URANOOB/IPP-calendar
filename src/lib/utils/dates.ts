import { format, formatDistanceToNow, isValid } from "date-fns";
import { es } from "date-fns/locale";

type DateInput = Date | string | number;

function toValidDate(value: DateInput): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return isValid(date) ? date : null;
}

export function formatDate(value: DateInput, pattern = "d 'de' MMMM 'de' yyyy") {
  const date = toValidDate(value);
  return date ? format(date, pattern, { locale: es }) : "";
}

export function formatRelativeDate(value: DateInput) {
  const date = toValidDate(value);
  return date ? formatDistanceToNow(date, { addSuffix: true, locale: es }) : "";
}
