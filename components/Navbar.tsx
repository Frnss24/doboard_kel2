"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { supabase } from "@/lib/supabase";
import { useReportNotifications } from "@/hooks/useReportNotifications";

const navItems = [
  { label: "Board", href: "/board" },
  { label: "Timeline", href: "/timeline" },
  { label: "Reports", href: "/reports" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { user, loading, signOut } = useSupabaseAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const { unreadCount } = useReportNotifications();

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    const checkAdmin = async () => {
      const { data } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      setIsAdmin(data?.role === "admin");
    };
    checkAdmin();
  }, [user]);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const userLabel = user?.user_metadata?.full_name || user?.email || "User";
  const userAvatar = userLabel.slice(0, 1).toUpperCase();

  const allNavItems = [
    ...navItems,
    ...(isAdmin ? [{ label: "Admin", href: "/admin" }] : []),
  ];

  if (pathname.startsWith("/admin")) {
    return null;
  }

  // Hide navbar on the login/register page
  if (pathname.startsWith("/login")) {
    return null;
  }

  return (
    <nav className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
      {/* Left section */}
      <div className="flex items-center gap-8">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="DoBOARD" className="h-8 w-8 object-contain" />
          <span className="text-lg font-bold text-gray-900">DoBOARD</span>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-1">
          {allNavItems.map((item) => {
            const isActive = pathname === item.href || (item.href === "/admin" && pathname.startsWith("/admin"));
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-4">
        {/* search removed to avoid duplication with page-level search */}

        {/* Notification */}
        <Link
          href="/reports#admin-responses"
          className="relative rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
          aria-label={unreadCount > 0 ? `${unreadCount} admin responses` : "View report notifications"}
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
            />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 h-4 min-w-4 rounded-full bg-rose-500 px-1 text-[10px] font-semibold leading-4 text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>

        {/* User Profile / Auth Actions */}
        {loading ? (
          <div className="h-9 w-28 animate-pulse rounded-lg bg-gray-100" />
        ) : user ? (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-semibold text-white">
                {userAvatar}
              </div>
              <span className="max-w-40 truncate text-sm font-medium text-gray-700">{userLabel}</span>
            </div>
            <Link
              href="/profile"
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Profile
            </Link>
            <button
              onClick={handleSignOut}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Logout
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Login
            </Link>
            <Link
              href="/login?mode=signup"
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Register
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
}
