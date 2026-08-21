export type PublicClassState = "upcoming" | "starting_soon" | "live" | "finished" | "cancelled";

export interface WaitingRoomClassTime { startsAt: string; endsAt: string; status: string; }

export function getPublicClassState(classItem: WaitingRoomClassTime, now = new Date()): PublicClassState {
  if (classItem.status === "cancelled") return "cancelled";
  const startsAt = new Date(classItem.startsAt); const endsAt = new Date(classItem.endsAt);
  if (now >= endsAt) return "finished";
  if (now >= startsAt) return "live";
  if (now >= new Date(startsAt.getTime() - 30 * 60 * 1000)) return "starting_soon";
  return "upcoming";
}

export function canShowMeetingLink(classItem: WaitingRoomClassTime, now = new Date()) {
  const startsAt = new Date(classItem.startsAt); const endsAt = new Date(classItem.endsAt);
  return classItem.status === "published" && now >= new Date(startsAt.getTime() - 30 * 60 * 1000) && now < endsAt;
}

export function remainingMilliseconds(startsAt: string, now = new Date()) { return Math.max(0, new Date(startsAt).getTime() - now.getTime()); }
