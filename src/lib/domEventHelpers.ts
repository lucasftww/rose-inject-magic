import type { SyntheticEvent } from "react";

export function hideImgOnError(e: SyntheticEvent<HTMLImageElement>): void {
  const el = e.currentTarget;
  if (el instanceof HTMLImageElement) el.style.display = "none";
}

export function setImgOpacityOnError(e: SyntheticEvent<HTMLImageElement>, opacity: string): void {
  const el = e.currentTarget;
  if (el instanceof HTMLImageElement) el.style.opacity = opacity;
}

export function withHTMLElementTarget(e: SyntheticEvent<HTMLElement>, fn: (el: HTMLElement) => void): void {
  const el = e.currentTarget;
  if (el instanceof HTMLElement) fn(el);
}

export function setBorderAndBoxShadow(e: SyntheticEvent<HTMLElement>, borderColor: string, boxShadow: string): void {
  withHTMLElementTarget(e, (el) => {
    el.style.borderColor = borderColor;
    el.style.boxShadow = boxShadow;
  });
}

export function clearBorderAndBoxShadow(e: SyntheticEvent<HTMLElement>): void {
  withHTMLElementTarget(e, (el) => {
    el.style.borderColor = "";
    el.style.boxShadow = "";
  });
}

export function setLinkAccentHover(e: SyntheticEvent<HTMLElement>, accentColor: string): void {
  withHTMLElementTarget(e, (el) => {
    el.style.borderColor = accentColor;
    el.style.color = accentColor;
  });
}

export function clearLinkAccentHover(e: SyntheticEvent<HTMLElement>): void {
  withHTMLElementTarget(e, (el) => {
    el.style.borderColor = "";
    el.style.color = "";
  });
}
