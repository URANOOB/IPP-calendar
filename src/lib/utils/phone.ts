/** Normalizes a Colombian mobile number to the stored E.164 form (+573001234567). */
export function normalizeColombianPhone(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  const localNumber = digits.startsWith("57") && digits.length === 12 ? digits.slice(2) : digits;

  if (!/^3\d{9}$/.test(localNumber)) {
    return null;
  }

  return `+57${localNumber}`;
}

export function formatColombianPhone(phone: string): string {
  const match = /^\+57(\d{3})(\d{3})(\d{4})$/.exec(phone);
  return match ? `+57 ${match[1]} ${match[2]} ${match[3]}` : phone;
}
