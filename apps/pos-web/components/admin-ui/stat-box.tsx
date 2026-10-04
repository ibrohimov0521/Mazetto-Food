"use client";

import { posLink } from "./router-link";
import { StatBox as SharedStatBox } from "@mazetto/ui";
import type { StatBoxProps as SharedStatBoxProps } from "@mazetto/ui";

export { InfoBox, StatGrid, type StatTone } from "@mazetto/ui";
export type StatBoxProps = Omit<SharedStatBoxProps, "LinkComponent">;

export function StatBox(props: StatBoxProps) {
  return <SharedStatBox {...props} LinkComponent={posLink} />;
}
