import type { AnchorHTMLAttributes, ComponentType } from "react";

export type UiLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
};

export type UiLinkComponent = ComponentType<UiLinkProps>;
