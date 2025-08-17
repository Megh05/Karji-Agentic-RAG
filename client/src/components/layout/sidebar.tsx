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
    <div className="w-64 lg:w-72 h-full max-h-screen bg-card dark:bg-card flex flex-col luxury-container rounded-none relative z-60 overflow-hidden">
      {/* Logo Section - Luxury Design */}
      <div className="p-4 lg:p-6 border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="bot-avatar">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl lg:text-2xl font-heading font-bold text-foreground">KarjiStore</h1>
            <p className="text-xs text-muted-foreground">Luxury AI Concierge</p>
          </div>
        </div>
      </div>

      {/* Navigation Menu - Luxury Design */}
      <nav className="flex-1 p-4 space-y-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={cn(
              "flex items-center space-x-3 px-4 py-4 rounded-xl",
              item.active 
                ? "bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-luxury" 
                : "text-foreground"
            )}>
              <Icon className="w-5 h-5 relative z-10" />
              <span className="font-medium relative z-10">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Status Indicator - Luxury Design */}
      <div className="p-4 border-t border-border">
        <div className="luxury-container px-3 py-2 bg-gradient-to-r from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 border-emerald-200 dark:border-emerald-700">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Assistant Online</span>
          </div>
        </div>
      </div>
    </div>
  );
}
