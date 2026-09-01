import { AppShell } from "@/components/shell/app-shell";
import { NotificationsBadgeLink } from "@/components/shared/notifications-badge-link";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      role="admin"
      notificationsDesktop={
        <NotificationsBadgeLink className="inline-flex items-center gap-1 text-sm font-semibold text-white/85 hover:text-white" />
      }
      notificationsMobile={<NotificationsBadgeLink iconOnly />}
    >
      {children}
    </AppShell>
  );
}
