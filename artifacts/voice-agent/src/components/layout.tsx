import { Link, useLocation } from "wouter";
import { Mic, History, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Command Center", href: "/", icon: Mic },
  { name: "Session History", href: "/sessions", icon: History },
  { name: "Dashboard", href: "/stats", icon: BarChart3 },
];

export function Sidebar() {
  const [location] = useLocation();

  return (
    <div className="flex h-screen w-64 flex-col border-r border-border bg-sidebar text-sidebar-foreground">
      <div className="p-6">
        <h2 className="text-lg font-bold tracking-tight text-sidebar-primary">
          Nexus Voice
        </h2>
        <p className="text-xs text-muted-foreground mt-1">Live AI Operations</p>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? location === "/"
              : location.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon
                className={cn(
                  "mr-3 h-5 w-5 flex-shrink-0",
                  isActive
                    ? "text-sidebar-primary-foreground"
                    : "text-muted-foreground group-hover:text-sidebar-accent-foreground"
                )}
                aria-hidden="true"
              />
              {item.name}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-sidebar-primary/20 flex items-center justify-center text-sidebar-primary font-medium text-xs">
            OP
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium">Operator</span>
            <span className="text-xs text-muted-foreground">Active</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto focus:outline-none">
        {children}
      </main>
    </div>
  );
}
