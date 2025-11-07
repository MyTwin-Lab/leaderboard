import type { PropsWithChildren } from "react";

export function ContentContainer({ children }: PropsWithChildren) {
  return <div className="mx-auto w-full max-w-6xl px-6 pb-16">{children}</div>;
}
