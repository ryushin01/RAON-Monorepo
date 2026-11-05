"use client";

import { useId, useState } from "react";
import { ViewerSettingsPanel } from "./viewer-settings";

/** 설정 패널을 여닫는 버튼. 패널은 버튼 바로 뒤에 오므로 읽는 순서와 초점 순서가 같다. */
export function ViewerSettingsToggle({
  buttonClassName,
  panelClassName,
}: {
  buttonClassName?: string;
  panelClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <>
      <button
        type="button"
        className={buttonClassName}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        보기 설정
      </button>
      <div className={panelClassName} hidden={!open}>
        <ViewerSettingsPanel id={id} />
      </div>
    </>
  );
}
