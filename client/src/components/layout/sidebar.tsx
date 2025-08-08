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
    <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
      {/* Logo Section */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Store className="text-white text-lg" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">KarjiStore</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">AI Sales Assistant</p>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-4 space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className={cn(
              "flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors",
              item.active 
                ? "bg-primary text-white" 
                : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            )}>
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Status Indicator */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2 text-sm">
          <div className="w-2 h-2 bg-secondary rounded-full animate-pulse"></div>
          <span className="text-gray-600 dark:text-gray-400">AI Assistant Online</span>
        </div>
      </div>
    </div>
  );
}
