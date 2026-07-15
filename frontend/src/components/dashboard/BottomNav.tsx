import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
  exact?: boolean;
}

interface BottomNavProps {
  items: NavItem[];
}

export const BottomNav = ({ items }: BottomNavProps) => {
  const location = useLocation();

  const isActive = (path: string, exact?: boolean) =>
    exact ? location.pathname === path : location.pathname.startsWith(path);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border flex items-center justify-around h-16 px-2 lg:hidden pb-safe">
      {items.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          className={cn(
            "flex flex-col items-center justify-center gap-1 w-full h-full text-[10px] font-medium transition-all active:scale-90",
            isActive(item.to, item.exact)
              ? "text-primary"
              : "text-muted-foreground"
          )}
        >
          <item.icon className={cn("w-5 h-5", isActive(item.to, item.exact) ? "fill-primary/10" : "")} />
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
};
