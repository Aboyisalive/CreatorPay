import { BusinessShell } from "@/components/business-shell";
import { SessionGate } from "@/components/session";

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <SessionGate require="business">
      <BusinessShell>{children}</BusinessShell>
    </SessionGate>
  );
}
