import type { EpisodeDoc } from "./document.js";
import type { EpisodeStatus, Genre, Role, WorkBadge, WorkStatus, WritingStage } from "./domain.js";

export interface User {
  id: string;
  email: string;
  nickname: string;
  role: Role;
  coinBalance: number;
}

export interface AuthResult {
  accessToken: string;
  user: User;
}

export interface WorkSummary {
  id: string;
  title: string;
  authorName: string;
  genre: Genre;
  status: WorkStatus;
  synopsis: string;
  viewCount: number;
  episodeCount: number;
  /** 공개한 회차 중 첫 번째 번호. 공개한 회차가 없으면 null이다. */
  firstEpisodeNumber: number | null;
  latestEpisodeAt: string | null;
  tags: string[];
  /** 평점이 없으면 null이다. */
  ratingAverage: number | null;
  ratingCount: number;
  /** 표지 이미지를 올렸을 때의 시각. 없으면 제목으로 만든 표지를 쓴다. */
  coverUpdatedAt: string | null;
  badges: WorkBadge[];
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface PublicEpisode {
  id: string;
  number: number;
  title: string;
  isFree: boolean;
  charCount: number;
  publishedAt: string;
}

export interface WorkDetail extends WorkSummary {
  episodePrice: number;
  /** 지금 살 수 있는 작품 전체 가격. 연재 중이거나 판매하지 않으면 null이다. */
  wholePrice: number | null;
  episodes: PublicEpisode[];
}

/** 로그인한 사용자가 이 작품에서 이미 가진 권리. 공개 작품 정보와 분리해 캐시에 섞이지 않게 한다. */
export interface WorkAccess {
  ownsWork: boolean;
  ownedEpisodeIds: string[];
  cartEpisodeIds: string[];
  workInCart: boolean;
  isFavorite: boolean;
  myRating: number | null;
  /** 마지막으로 읽은 회차 번호 */
  lastReadNumber: number | null;
  /** 이미 산 회차 금액을 뺀 작품 전체 가격. 전체 구매를 팔지 않으면 null이다. */
  wholePriceForUser: number | null;
}

export interface FavoriteWork extends WorkSummary {
  lastReadNumber: number | null;
}

export interface ReadingEntry extends WorkSummary {
  lastReadNumber: number;
  lastReadAt: string;
}

export interface EpisodeCommentList {
  /** 최신순으로 일부만 담는다. */
  items: EpisodeComment[];
  total: number;
}

export interface EpisodeComment {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
  /** 쓴 사람과 작품의 작가만 지울 수 있다. */
  canDelete: boolean;
}

export interface EpisodeNeighbor {
  number: number;
  title: string;
}

export interface EpisodeView {
  id: string;
  workId: string;
  workTitle: string;
  authorName: string;
  number: number;
  title: string;
  isFree: boolean;
  publishedAt: string;
  prev: EpisodeNeighbor | null;
  next: EpisodeNeighbor | null;
  /** 볼 권한이 없으면 false이고 content와 authorNote는 내려가지 않는다. */
  accessible: boolean;
  price: number;
  content: EpisodeDoc | null;
  authorNote: string | null;
}

export interface CartItem {
  id: string;
  kind: "EPISODE" | "WORK";
  workId: string;
  workTitle: string;
  episodeId: string | null;
  episodeNumber: number | null;
  episodeTitle: string | null;
  /** 항상 서버가 현재 가격으로 계산한다. */
  price: number;
  /** 담아 둔 뒤 판매가 끝났거나 이미 구매해 결제할 수 없는 항목의 이유 */
  unavailableReason: string | null;
}

export interface Cart {
  items: CartItem[];
  total: number;
  coinBalance: number;
}

export interface OrderResult {
  orderId: string;
  total: number;
  coinBalance: number;
}

export interface LibraryItem {
  orderItemId: string;
  kind: "EPISODE" | "WORK";
  workId: string;
  workTitle: string;
  episodeNumber: number | null;
  episodeTitle: string | null;
  price: number;
  purchasedAt: string;
}

export interface CoinEntry {
  id: string;
  amount: number;
  reason: "CHARGE" | "PURCHASE";
  createdAt: string;
}

export interface Wallet {
  coinBalance: number;
  entries: CoinEntry[];
}

export interface StudioWork {
  id: string;
  title: string;
  genre: Genre;
  status: WorkStatus;
  synopsis: string;
  episodePrice: number;
  wholePrice: number | null;
  viewCount: number;
  publishedEpisodeCount: number;
  draftEpisodeCount: number;
  salesCount: number;
  salesCoins: number;
  favoriteCount: number;
  tags: string[];
  coverUpdatedAt: string | null;
  updatedAt: string;
}

export interface StudioEpisodeSummary {
  id: string;
  number: number;
  title: string;
  status: EpisodeStatus;
  writingStage: WritingStage;
  isFree: boolean;
  charCount: number;
  updatedAt: string;
  publishedAt: string | null;
}

/** 휴지통에 있는 회차. 복원하면 원래 번호로 돌아온다. */
export interface TrashedEpisode {
  id: string;
  number: number;
  title: string;
  charCount: number;
  deletedAt: string;
}

/** 휴지통에 있는 작품. 복원하면 공개 상태와 회차가 그대로 돌아온다. */
export interface TrashedWork {
  id: string;
  title: string;
  episodeCount: number;
  deletedAt: string;
}

export interface StudioWorkDetail extends StudioWork {
  episodes: StudioEpisodeSummary[];
  trash: TrashedEpisode[];
}

export interface StudioEpisode extends StudioEpisodeSummary {
  workId: string;
  content: EpisodeDoc;
  authorNote: string | null;
}

export interface EpisodeVersionSummary {
  id: string;
  /** AUTO는 저장할 때 일정 간격으로, MANUAL은 작가가 직접 남긴 버전이다. */
  kind: "AUTO" | "MANUAL";
  label: string | null;
  title: string;
  charCount: number;
  createdAt: string;
}

export interface EpisodeVersion extends EpisodeVersionSummary {
  content: EpisodeDoc;
  authorNote: string | null;
}

export interface WorkNote {
  id: string;
  workId: string;
  episodeId: string | null;
  kind: "SETTING" | "MEMO";
  category: string;
  title: string;
  aliases: string[];
  body: string;
  updatedAt: string;
}

export interface Foreshadow {
  id: string;
  workId: string;
  title: string;
  body: string;
  plantedEpisodeId: string | null;
  resolvedEpisodeId: string | null;
  updatedAt: string;
}

export interface WorkSearchHit {
  id: string;
  title: string;
  matches: number;
  snippet: string;
}

export interface WorkSearchResult {
  episodes: (WorkSearchHit & { number: number })[];
  notes: (WorkSearchHit & { kind: "SETTING" | "MEMO" })[];
}

/** 내보내기용. 지금 있는 모든 회차의 본문을 담는다. */
export interface WorkExport {
  title: string;
  episodes: {
    number: number;
    title: string;
    status: EpisodeStatus;
    content: EpisodeDoc;
    authorNote: string | null;
  }[];
}

export interface ApiErrorBody {
  statusCode: number;
  message: string;
  fieldErrors?: Record<string, string>;
}
