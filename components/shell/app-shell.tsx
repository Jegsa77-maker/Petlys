"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { signOut } from "@/lib/actions/auth";
import { NAV_BY_ROLE, ROLE_LABEL, MOBILE_TAB_LIMIT, type ShellRole } from "./nav-config";

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(href + "/");
}

/**
 * Shell responsivo (M-001/M-002, iniciativa de CX — Matriz_Responsiva do
 * inventário): sidebar fixa com logo/nav em telas largas, barra superior
 * compacta + barra inferior de navegação em telas pequenas. Um componente
 * só, reaproveitado nas 4 visões — só o `role` muda o que aparece.
 *
 * Propositalmente não toca no conteúdo de cada página: quem chama isto
 * (os `layout.tsx` de cada grupo de rota) só embrulha `children`, sem
 * mexer no `<main>` que cada página já tem.
 */
export function AppShell({
  role,
  notificationsDesktop,
  notificationsMobile,
  children,
}: {
  role: ShellRole;
  /** Versão clara (fundo escuro da sidebar) — ver notifications-badge-link.tsx. */
  notificationsDesktop?: React.ReactNode;
  /** Versão compacta/ícone (fundo claro do cabeçalho mobile). */
  notificationsMobile?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const items = NAV_BY_ROLE[role];
  const mobileItems = items.slice(0, MOBILE_TAB_LIMIT);

  return (
    <div className="md:flex md:min-h-screen">
      {/* Sidebar — computador (Matriz_Responsiva: "barra lateral ou superior") */}
      <aside className="hidden md:flex md:w-60 md:shrink-0 md:flex-col bg-teal text-white">
        <Link href={items[0]?.href ?? "/"} className="flex items-center gap-2 px-5 py-6">
          <Image src="/logo-petlys.png" alt="Petlys" width={34} height={40} />
          <span>
            <span className="block font-bold tracking-widest text-sm">PETLYS</span>
            <span className="block text-xs text-white/70">{ROLE_LABEL[role]}</span>
          </span>
        </Link>

        <nav className="flex-1 px-3 flex flex-col gap-1">
          {items.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  active ? "bg-white/15 font-semibold" : "text-white/85 hover:bg-white/10"
                }`}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-white/10 flex flex-col gap-1">
          {notificationsDesktop && <div className="px-3 py-1">{notificationsDesktop}</div>}
          <form action={signOut}>
            <button
              type="submit"
              className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/70 hover:bg-white/10 hover:text-white"
            >
              <LogOut size={18} />
              Sair
            </button>
          </form>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Barra superior compacta — celular (Matriz_Responsiva: "cabeçalho compacto") */}
        <header className="md:hidden sticky top-0 z-20 flex items-center justify-between gap-2 bg-white border-b border-gray-200 px-4 py-2.5">
          <Link href={items[0]?.href ?? "/"} className="flex items-center gap-2 min-w-0">
            <Image src="/logo-petlys.png" alt="Petlys" width={26} height={30} />
            <span className="font-bold text-teal tracking-widest text-sm">PETLYS</span>
          </Link>
          {notificationsMobile}
        </header>

        <div className="flex-1 pb-16 md:pb-0">{children}</div>

        {/* Barra inferior — celular (Matriz_Responsiva: "barra inferior") */}
        <nav
          aria-label="Navegação principal"
          className="md:hidden fixed bottom-0 inset-x-0 z-20 flex bg-white border-t border-gray-200"
        >
          {mobileItems.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] ${
                  active ? "text-teal font-semibold" : "text-gray-500"
                }`}
              >
                <Icon size={20} />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
