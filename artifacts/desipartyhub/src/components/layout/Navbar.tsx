import { Link, useLocation } from "wouter";
import { useGetCurrentUser, useLogoutUser } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Menu, X } from "lucide-react";
import { useState } from "react";

export function Navbar() {
  const [location] = useLocation();
  const { data: user, isLoading } = useGetCurrentUser();
  const logoutUser = useLogoutUser();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logoutUser.mutate(undefined, {
      onSuccess: () => {
        window.location.href = "/";
      },
    });
  };

  const navLinks = [
    { href: "/vendors", label: "Vendors" },
    { href: "/categories", label: "Categories" },
  ];

  if (user) {
    navLinks.push({ href: "/checklist", label: "Checklist" });
    navLinks.push({ href: "/budget", label: "Budget" });
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-20 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center">
            <img src="/logo.png" alt="Desi Party Vibes" className="h-16 w-auto" />
          </Link>
          <nav className="hidden md:flex gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors hover:text-primary ${
                  location.startsWith(link.href) ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="hidden md:flex items-center gap-4">
          {!isLoading && !user && location !== "/login" && location !== "/register" && (
            <>
              <Button variant="ghost" asChild>
                <Link href="/login">Log in</Link>
              </Button>
              <Button asChild>
                <Link href="/register">Sign up</Link>
              </Button>
            </>
          )}

          {user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.avatarUrl || ""} alt={user.name} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {user.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile">Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/bookings">My Bookings</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/favorites">Favorites</Link>
                </DropdownMenuItem>
                {user.role === "admin" && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin">Admin Dashboard</Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden border-t bg-background p-4 space-y-4">
          <nav className="flex flex-col gap-4">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="border-t pt-4 flex flex-col gap-4">
            {!isLoading && !user && location !== "/login" && location !== "/register" ? (
              <>
                <Button variant="outline" asChild className="w-full justify-start">
                  <Link href="/login" onClick={() => setMobileMenuOpen(false)}>Log in</Link>
                </Button>
                <Button asChild className="w-full justify-start">
                  <Link href="/register" onClick={() => setMobileMenuOpen(false)}>Sign up</Link>
                </Button>
              </>
            ) : (
              <>
                <Link href="/profile" className="text-sm font-medium" onClick={() => setMobileMenuOpen(false)}>Profile</Link>
                <Link href="/bookings" className="text-sm font-medium" onClick={() => setMobileMenuOpen(false)}>My Bookings</Link>
                <Link href="/favorites" className="text-sm font-medium" onClick={() => setMobileMenuOpen(false)}>Favorites</Link>
                {user?.role === "admin" && (
                  <Link href="/admin" className="text-sm font-medium" onClick={() => setMobileMenuOpen(false)}>Admin Dashboard</Link>
                )}
                <Button variant="ghost" className="w-full justify-start px-0 text-red-600" onClick={handleLogout}>Log out</Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
