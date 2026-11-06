"use client";

import { useState } from "react";
import {
  EXPORT_FORMATS,
  type ExportFormat,
  exportFileName,
  exportMimeType,
  renderEpisodeExport,
} from "@/entities/episode";
import { downloadText } from "@/shared/lib";
import { Button } from "@/shared/ui";
import styles from "./writing-tools.module.scss";

type ExportInput = Parameters<typeof renderEpisodeExport>[1];

/** 저장하지 않은 입력까지 지금 화면의 내용을 내보낸다. */
export function EpisodeExport({ getEpisode }: { getEpisode: () => ExportInput }) {
  const [message, setMessage] = useState("");
  const run = (format: ExportFormat) => {
    const episode = getEpisode();
    const name = exportFileName(`${episode.number}화 ${episode.title}`, format);
    downloadText(name, renderEpisodeExport(format, episode), exportMimeType(format));
    setMessage(`${name} 파일을 내보냈습니다.`);
  };
  return (
    <>
      <div className={styles.actions}>
        {EXPORT_FORMATS.map(({ value, label }) => (
          <Button key={value} variant="secondary" small type="button" onClick={() => run(value)}>
            {label}로 내보내기
          </Button>
        ))}
      </div>
      <p className={styles.note} role="status">
        {message}
      </p>
    </>
  );
}
