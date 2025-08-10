import { Link, useLocation } from "wouter";
import { Store, MessageCircle, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Sidebar() {
  const [location] = useLocation();

  const navItems = [
    {
      href: "/",
      label: "Chat Interface",
      icon: MessageCircle,
      active: location === "/"
    },
    {
      href: "/admin",
      label: "Admin Dashboard", 
      icon: Settings,
      active: location === "/admin"
    }
  ];

  return (
    <div className="w-64 bg-card dark:bg-card border-r border-border flex flex-col">
      {/* Logo Section */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-amber-600 via-yellow-600 to-amber-700 dark:from-amber-500 dark:via-yellow-500 dark:to-amber-600 rounded-xl flex items-center justify-center shadow-lg">
            <Store className="text-white text-lg" />
          </div>
          <div>
            <h1 className="text-2xl font-serif font-bold bg-gradient-to-r from-amber-600 via-yellow-600 to-amber-700 dark:from-amber-400 dark:via-yellow-400 dark:to-amber-500 bg-clip-text text-transparent">KarjiStore</h1>
            <p className="text-xs text-muted-foreground">Luxury AI Concierge</p>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={cn(
              "flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200",
              item.active 
                ? "bg-gradient-to-r from-amber-600 via-yellow-600 to-amber-700 dark:from-amber-500 dark:via-yellow-500 dark:to-amber-600 text-white shadow-lg" 
                : "text-foreground hover:bg-accent hover:shadow-sm"
            )}>
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Status Indicator */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center space-x-2 text-sm">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-sm"></div>
          <span className="text-muted-foreground">Luxury Assistant Online</span>
        </div>
      </div>
    </div>
  );
}
