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

/** 작품 형식. 같은 계정과 코인으로 두 가지를 함께 읽고 판다. 만든 뒤에는 바꿀 수 없다. */
export const WORK_FORMATS = ["COMIC", "NOVEL"] as const;
export const workFormatSchema = z.enum(WORK_FORMATS);
export type WorkFormat = z.infer<typeof workFormatSchema>;
export const WORK_FORMAT_LABEL: Record<WorkFormat, string> = { COMIC: "웹툰", NOVEL: "웹소설" };

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

/** 회차의 성격. 독자에게 글자로 보여 준다. 번호와 가격에는 영향이 없다. */
export const EPISODE_TYPES = ["REGULAR", "PROLOGUE", "EPILOGUE", "SIDE", "NOTICE"] as const;
export const episodeTypeSchema = z.enum(EPISODE_TYPES);
export type EpisodeType = z.infer<typeof episodeTypeSchema>;
export const EPISODE_TYPE_LABEL: Record<EpisodeType, string> = {
  REGULAR: "본편",
  PROLOGUE: "프롤로그",
  EPILOGUE: "에필로그",
  SIDE: "외전",
  NOTICE: "공지",
};

/** 초안이 어디까지 왔는지 작가가 표시한다. 공개 상태나 독자 화면과는 관계가 없다. */
export const WRITING_STAGES = ["IDEA", "DRAFTING", "REVISING", "FINISHED"] as const;
export const writingStageSchema = z.enum(WRITING_STAGES);
export type WritingStage = z.infer<typeof writingStageSchema>;
export const WRITING_STAGE_LABEL: Record<WritingStage, string> = {
  IDEA: "구상",
  DRAFTING: "초고",
  REVISING: "퇴고",
  FINISHED: "완성",
};

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
export const MAX_NOTE_PROPERTIES = 30;
/** 웹툰 회차 이미지 제한. 한 장씩 서버 액션(3MB)을 거치므로 그보다 작게 둔다. */
export const COMIC_IMAGE_MAX_BYTES = Math.floor(2.5 * 1024 * 1024);
export const COMIC_IMAGE_MAX_COUNT = 100;
