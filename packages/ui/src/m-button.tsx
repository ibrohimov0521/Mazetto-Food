import type { ComponentPropsWithoutRef } from "react";

export type MButtonProps = ComponentPropsWithoutRef<"button">;

export function MButton({ type = "button", ...props }: MButtonProps) {
  return <button type={type} {...props} />;
}
