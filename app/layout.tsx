import { AppLayoutWrapper } from "@/components/layout/AppLayoutWrapper";
import { RequireAuth } from "@/components/auth/RequireAuth";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireAuth>
      <AppLayoutWrapper>
        {children}
      </AppLayoutWrapper>
    </RequireAuth>
  );
}
