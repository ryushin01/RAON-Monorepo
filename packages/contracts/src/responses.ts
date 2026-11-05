import type { EpisodeDoc } from "./document.js";
import type { EpisodeStatus, Genre, Role, WorkStatus } from "./domain.js";

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
  latestEpisodeAt: string | null;
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
  updatedAt: string;
}

export interface StudioEpisodeSummary {
  id: string;
  number: number;
  title: string;
  status: EpisodeStatus;
  isFree: boolean;
  charCount: number;
  updatedAt: string;
  publishedAt: string | null;
}

export interface StudioWorkDetail extends StudioWork {
  episodes: StudioEpisodeSummary[];
}

export interface StudioEpisode extends StudioEpisodeSummary {
  workId: string;
  content: EpisodeDoc;
  authorNote: string | null;
}

export interface ApiErrorBody {
  statusCode: number;
  message: string;
  fieldErrors?: Record<string, string>;
}
