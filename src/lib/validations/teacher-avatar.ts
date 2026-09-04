export const TEACHER_AVATAR_TYPES = new Map([
  ["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"],
]);

export function teacherAvatarError(file: File): string | null {
  return !TEACHER_AVATAR_TYPES.has(file.type) || file.size === 0 || file.size > 5 * 1024 * 1024
    ? "Selecciona una imagen JPG, PNG o WebP de máximo 5 MB."
    : null;
}
