"use client";

import { useId, useSyncExternalStore } from "react";
import {
  MAX_LEADING,
  MAX_SIZE,
  MIN_LEADING,
  MIN_SIZE,
  type ViewerSettings as Settings,
  viewerSettings,
} from "../model/store";
import styles from "./viewer-settings.module.scss";

const THEMES: { value: Settings["theme"]; label: string }[] = [
  { value: "auto", label: "자동" },
  { value: "white", label: "흰색" },
  { value: "gray", label: "회색" },
  { value: "black", label: "검정" },
];

const FONTS: { value: Settings["font"]; label: string }[] = [
  { value: "serif", label: "명조" },
  { value: "sans", label: "고딕" },
];

function Options<T extends string>({
  legend,
  name,
  options,
  value,
  onChange,
}: {
  legend: string;
  name: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.options}>
        {options.map((option) => (
          <label key={option.value} className={styles.option}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Stepper({
  legend,
  display,
  onDecrease,
  onIncrease,
  canDecrease,
  canIncrease,
}: {
  legend: string;
  display: string;
  onDecrease: () => void;
  onIncrease: () => void;
  canDecrease: boolean;
  canIncrease: boolean;
}) {
  return (
    <fieldset className={styles.group}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.stepper}>
        <button type="button" onClick={onDecrease} disabled={!canDecrease} aria-label={`${legend} 줄이기`}>
          −
        </button>
        <output>{display}</output>
        <button type="button" onClick={onIncrease} disabled={!canIncrease} aria-label={`${legend} 늘리기`}>
          +
        </button>
      </div>
    </fieldset>
  );
}

export function ViewerSettingsPanel({ id }: { id?: string }) {
  const settings = useSyncExternalStore(viewerSettings.subscribe, viewerSettings.get, viewerSettings.getServer);
  const { update } = viewerSettings;
  // 숨겨진 다른 회차 화면의 라디오와 묶이지 않도록 이름을 화면마다 다르게 한다.
  const name = useId();

  return (
    <div id={id} className={styles.panel}>
      <Options
        legend="배경"
        name={`${name}-theme`}
        options={THEMES}
        value={settings.theme}
        onChange={(theme) => update({ theme })}
      />
      <Options
        legend="글꼴"
        name={`${name}-font`}
        options={FONTS}
        value={settings.font}
        onChange={(font) => update({ font })}
      />
      <Stepper
        legend="글자 크기"
        display={`${settings.size}px`}
        onDecrease={() => update({ size: settings.size - 1 })}
        onIncrease={() => update({ size: settings.size + 1 })}
        canDecrease={settings.size > MIN_SIZE}
        canIncrease={settings.size < MAX_SIZE}
      />
      <Stepper
        legend="줄 간격"
        display={settings.leading.toFixed(1)}
        onDecrease={() => update({ leading: settings.leading - 0.1 })}
        onIncrease={() => update({ leading: settings.leading + 0.1 })}
        canDecrease={settings.leading > MIN_LEADING}
        canIncrease={settings.leading < MAX_LEADING}
      />
    </div>
  );
}
