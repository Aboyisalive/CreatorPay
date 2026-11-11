import { CreatorShell } from "@/components/creator-shell";
import { SessionGate } from "@/components/session";

export default function CreatorLayout({ children }: LayoutProps<"/creator">) {
  return (
    <SessionGate require="creator">
      <CreatorShell>{children}</CreatorShell>
    </SessionGate>
  );
}
