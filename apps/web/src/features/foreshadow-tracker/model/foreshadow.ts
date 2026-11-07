import type { Foreshadow, ForeshadowInput } from "@raon/contracts";

export interface EpisodeOption {
  id: string;
  number: number;
  title: string;
  /** 휴지통에 있는 회차다. 복원할 수 있어 연결은 유지하지만 진행 계산에서는 뺀다. */
  trashed?: boolean;
}

const episodeLabel = (episode: EpisodeOption | undefined) =>
  episode ? `${episode.number}화${episode.trashed ? "(휴지통)" : ""}` : null;

/** 복선의 진행을 한 문장으로 알린다. 회차가 없으면 알 수 있는 만큼만 적는다. */
export function describeForeshadow(foreshadow: Foreshadow, episodes: EpisodeOption[]): string {
  const find = (id: string | null) => episodes.find((episode) => episode.id === id);
  const planted = find(foreshadow.plantedEpisodeId);
  const resolved = find(foreshadow.resolvedEpisodeId);
  const plantedText = episodeLabel(planted);
  if (resolved) {
    const text = `${plantedText ? `${plantedText}에 심고 ` : ""}${episodeLabel(resolved)}에서 회수했습니다.`;
    return planted && resolved.number < planted.number ? `${text} 회수 회차가 심은 회차보다 앞에 있습니다.` : text;
  }
  if (!planted) return "아직 심은 회차를 고르지 않았습니다.";
  if (planted.trashed) return `${plantedText}에 심었습니다. 아직 회수하지 않았습니다.`;
  const latest = Math.max(...episodes.filter((episode) => !episode.trashed).map((episode) => episode.number));
  const gap = latest - planted.number;
  return `${plantedText}에 심었습니다. ${gap > 0 ? `${gap}개 회차가 지나도록 ` : "아직 "}회수하지 않았습니다.`;
}

export const isResolved = (foreshadow: Foreshadow) => foreshadow.resolvedEpisodeId !== null;

export const toForeshadowInput = (
  { title, body, plantedEpisodeId, resolvedEpisodeId }: Foreshadow,
  changes: Partial<ForeshadowInput> = {},
): ForeshadowInput => ({ title, body, plantedEpisodeId, resolvedEpisodeId, ...changes });
