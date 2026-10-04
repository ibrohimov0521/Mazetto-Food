"use client";

import { posLink } from "./router-link";
import { ButtonLink as SharedButtonLink } from "@mazetto/ui";
import type { ButtonLinkProps as SharedButtonLinkProps } from "@mazetto/ui";

export {
  Button,
  GuardedButton,
  type ButtonProps,
  type ButtonSize,
  type ButtonVariant,
} from "@mazetto/ui";

export type ButtonLinkProps = Omit<SharedButtonLinkProps, "LinkComponent">;

export function ButtonLink(props: ButtonLinkProps) {
  return <SharedButtonLink {...props} LinkComponent={posLink} />;
}
