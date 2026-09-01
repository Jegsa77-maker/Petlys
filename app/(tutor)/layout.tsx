import { AppShell } from "@/components/shell/app-shell";
import { NotificationsBadgeLink } from "@/components/shared/notifications-badge-link";

export default function TutorLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      role="tutor"
      notificationsDesktop={
        <NotificationsBadgeLink className="inline-flex items-center gap-1 text-sm font-semibold text-white/85 hover:text-white" />
      }
      notificationsMobile={<NotificationsBadgeLink iconOnly />}
    >
      {children}
    </AppShell>
  );
}
