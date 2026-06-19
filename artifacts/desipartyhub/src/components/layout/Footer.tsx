import { Link } from "wouter";
import { PartyPopper, Instagram, Twitter, Facebook } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-card border-t py-12 mt-auto">
      <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
        <div className="space-y-4">
          <Link href="/" className="flex items-center gap-2 text-primary font-serif font-bold text-xl">
            <PartyPopper className="h-6 w-6" />
            <span>Desi Party Vibes</span>
          </Link>
          <p className="text-sm text-muted-foreground">
            The premium marketplace for Indian-American celebrations. Find trusted vendors for your perfect event.
          </p>
        </div>
        
        <div>
          <h3 className="font-semibold mb-4 text-foreground">For Users</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link href="/vendors" className="hover:text-primary">Find Vendors</Link></li>
            <li><Link href="/categories" className="hover:text-primary">Categories</Link></li>
            <li><Link href="/checklist" className="hover:text-primary">Planning Checklist</Link></li>
            <li><Link href="/budget" className="hover:text-primary">Budget Calculator</Link></li>
          </ul>
        </div>
        
        <div>
          <h3 className="font-semibold mb-4 text-foreground">For Vendors</h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link href="/register?role=vendor" className="hover:text-primary">Join as Professional</Link></li>
            <li><Link href="/login" className="hover:text-primary">Vendor Login</Link></li>
            <li><span className="cursor-not-allowed">Success Stories</span></li>
          </ul>
        </div>
        
        <div>
          <h3 className="font-semibold mb-4 text-foreground">Connect</h3>
          <div className="flex gap-4">
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
      <div className="container mx-auto px-4 mt-12 pt-8 border-t text-center text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} Desi Party Vibes. All rights reserved.
      </div>
    </footer>
  );
}

import { Button } from "@/components/ui/button";