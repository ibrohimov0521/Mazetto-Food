"use client";

import Link from "next/link";
import type { ComponentProps } from "react";
import type { UiLinkComponent } from "@mazetto/ui";

export const posLink: UiLinkComponent = (props) => (
  <Link {...(props as ComponentProps<typeof Link>)} />
);
