"use client";

import {
  EPISODE_TYPE_LABEL,
  EPISODE_TYPES,
  type EpisodeMetaInput,
  type EpisodeType,
  type StudioEpisode,
} from "@raon/contracts";
import { type FormEvent, useState } from "react";
import { useLockedMutation } from "@/shared/lib";
import { Button, SelectField, TextField } from "@/shared/ui";
import { saveEpisodeMeta } from "../api/episode-meta-actions";
import styles from "./episode-meta.module.scss";

/** 회차 유형과 시점. 원고와 따로 저장하므로 버전이 남지 않는다. */
export function EpisodeMeta({
  episode,
  showPointOfView = true,
}: {
  episode: Pick<StudioEpisode, "id" | "episodeType" | "pointOfView">;
  /** 웹툰에는 시점 메모를 두지 않는다. */
  showPointOfView?: boolean;
}) {
  const [episodeType, setEpisodeType] = useState<EpisodeType>(episode.episodeType);
  const [pointOfView, setPointOfView] = useState(episode.pointOfView);
  const [message, setMessage] = useState("");
  const save = useLockedMutation({
    mutationFn: async (input: EpisodeMetaInput) => {
      const result = await saveEpisodeMeta(episode.id, input);
      if (!result.ok) throw new Error(result.fieldErrors?.pointOfView ?? result.message);
      return result.data;
    },
    onMutate: () => setMessage(""),
    onSuccess: () => setMessage("회차 정보를 저장했습니다."),
  });

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!save.isPending) save.run({ episodeType, pointOfView });
  };

  return (
    <form className={styles.form} onSubmit={onSubmit} noValidate>
      <SelectField
        label="회차 유형"
        value={episodeType}
        hint="독자에게 글자로 보입니다."
        onChange={(event) => setEpisodeType(event.target.value as EpisodeType)}
      >
        {EPISODE_TYPES.map((type) => (
          <option key={type} value={type}>
            {EPISODE_TYPE_LABEL[type]}
          </option>
        ))}
      </SelectField>
      {showPointOfView && (
        <TextField
          label="시점"
          value={pointOfView}
          maxLength={30}
          error={save.error?.message}
          hint="누구의 시점인지 적어 둡니다. 작가만 봅니다."
          onChange={(event) => setPointOfView(event.target.value)}
        />
      )}
      <div>
        <Button type="submit" variant="secondary" small aria-disabled={save.isPending}>
          회차 정보 저장
        </Button>
      </div>
      {!showPointOfView && save.error && <p role="alert">{save.error.message}</p>}
      <p className={styles.note} role="status">
        {message}
      </p>
    </form>
  );
}
