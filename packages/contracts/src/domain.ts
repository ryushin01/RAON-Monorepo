import { z } from "zod";

export const ROLES = ["READER", "AUTHOR"] as const;
export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;
export const ROLE_LABEL: Record<Role, string> = { READER: "일반 회원", AUTHOR: "작가" };

export const GENRES = ["FANTASY", "MARTIAL", "ROMANCE", "MODERN", "SF", "MYSTERY"] as const;
export const genreSchema = z.enum(GENRES);
export type Genre = z.infer<typeof genreSchema>;
export const GENRE_LABEL: Record<Genre, string> = {
  FANTASY: "판타지",
  MARTIAL: "무협",
  ROMANCE: "로맨스",
  MODERN: "현대",
  SF: "SF",
  MYSTERY: "미스터리",
};

export const WORK_STATUSES = ["DRAFT", "ONGOING", "COMPLETED"] as const;
export const workStatusSchema = z.enum(WORK_STATUSES);
export type WorkStatus = z.infer<typeof workStatusSchema>;
export const WORK_STATUS_LABEL: Record<WorkStatus, string> = {
  DRAFT: "공개 전",
  ONGOING: "연재 중",
  COMPLETED: "완결",
};

export const EPISODE_STATUSES = ["DRAFT", "PUBLISHED"] as const;
export const episodeStatusSchema = z.enum(EPISODE_STATUSES);
export type EpisodeStatus = z.infer<typeof episodeStatusSchema>;

export const WORK_SORTS = ["popular", "latest", "rating"] as const;
export const workSortSchema = z.enum(WORK_SORTS);
export type WorkSort = z.infer<typeof workSortSchema>;

/** 가상 결제로 충전할 수 있는 코인 묶음. 금액은 서버가 이 목록으로만 정한다. */
export const COIN_PACKAGES = [1000, 3000, 5000, 10000] as const;

export const WORK_BADGES = ["HOT", "NEW", "UP"] as const;
export type WorkBadge = (typeof WORK_BADGES)[number];
export const WORK_BADGE_LABEL: Record<WorkBadge, string> = { HOT: "인기", NEW: "신작", UP: "새 회차" };

/** 표지 이미지 제한. 웹이 먼저 안내하고 API가 다시 검사한다. */
export const COVER_MAX_BYTES = 2 * 1024 * 1024;
export const COVER_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_TAGS = 5;
