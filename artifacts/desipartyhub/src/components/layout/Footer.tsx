import { Link } from "wouter";
import { Instagram, Twitter, Facebook } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Footer() {
  return (
    <footer className="bg-card border-t py-10 mt-auto">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_1fr] gap-8 items-start">
          <div className="flex flex-col justify-center">
            <Link href="/">
              <img src="/logo-full.png" alt="Desi Party Vibes" className="w-full max-w-xs" />
            </Link>
          </div>

          <div className="flex flex-col gap-3 md:pl-4">
            <h3 className="font-semibold text-foreground">For Users</h3>
            <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
              <li><Link href="/vendors" className="hover:text-primary transition-colors">Find Vendors</Link></li>
              <li><Link href="/categories" className="hover:text-primary transition-colors">Categories</Link></li>
              <li><Link href="/checklist" className="hover:text-primary transition-colors">Planning Checklist</Link></li>
              <li><Link href="/budget" className="hover:text-primary transition-colors">Budget Calculator</Link></li>
            </ul>
          </div>

          <div className="flex flex-col gap-3 md:pl-4">
            <h3 className="font-semibold text-foreground">For Vendors</h3>
            <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
              <li><Link href="/register?role=vendor" className="hover:text-primary transition-colors">Join as Professional</Link></li>
              <li><Link href="/login" className="hover:text-primary transition-colors">Vendor Login</Link></li>
              <li><span className="cursor-not-allowed">Success Stories</span></li>
            </ul>
          </div>

          <div className="flex flex-col gap-3 md:pl-4">
            <h3 className="font-semibold text-foreground">Connect</h3>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary" asChild>
                <a href="#"><Instagram className="h-5 w-5" /></a>
              </Button>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary" asChild>
                <a href="#"><Facebook className="h-5 w-5" /></a>
              </Button>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary" asChild>
                <a href="#"><Twitter className="h-5 w-5" /></a>
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t text-center text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} Desi Party Vibes. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
