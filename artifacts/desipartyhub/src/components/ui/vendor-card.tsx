import { Link } from "wouter";
import { Vendor } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Star, MapPin, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AspectRatio } from "@/components/ui/aspect-ratio";

interface VendorCardProps {
  vendor: Vendor;
  isFavorite?: boolean;
  onToggleFavorite?: (id: number) => void;
}

export function VendorCard({ vendor, isFavorite = false, onToggleFavorite }: VendorCardProps) {
  return (
    <Card className="group overflow-hidden transition-all hover:shadow-lg border-muted">
      <Link href={`/vendors/${vendor.id}`}>
        <div className="relative">
          <AspectRatio ratio={4/3}>
            <img 
              src={vendor.imageUrl} 
              alt={vendor.name} 
              className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
            />
          </AspectRatio>
          {vendor.isFeatured && (
            <Badge className="absolute top-3 left-3 bg-secondary text-secondary-foreground border-none">
              Featured
            </Badge>
          )}
          {onToggleFavorite && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-3 right-3 bg-black/20 hover:bg-black/40 text-white rounded-full w-8 h-8 backdrop-blur-sm z-10"
              onClick={(e) => {
                e.preventDefault();
                onToggleFavorite(vendor.id);
              }}
            >
              <Heart className={`h-4 w-4 ${isFavorite ? "fill-red-500 text-red-500" : ""}`} />
            </Button>
          )}
        </div>
        <CardContent className="p-5">
          <div className="flex justify-between items-start mb-2">
            <Badge variant="outline" className="text-xs bg-muted/50 border-primary/20 text-primary">
              {vendor.categoryName}
            </Badge>
            <div className="flex items-center gap-1 text-sm font-medium">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <span>{vendor.rating.toFixed(1)}</span>
              <span className="text-muted-foreground font-normal">({vendor.reviewCount})</span>
            </div>
          </div>
          
          <h3 className="font-serif text-xl font-semibold line-clamp-1 mb-1 group-hover:text-primary transition-colors">
            {vendor.name}
          </h3>
          
          <div className="flex items-center text-sm text-muted-foreground mb-3 gap-1">
            <MapPin className="h-4 w-4" />
            <span className="line-clamp-1">{vendor.city}, {vendor.state}</span>
          </div>
          
          <p className="text-sm text-muted-foreground line-clamp-2 mb-4 h-10">
            {vendor.description}
          </p>
          
          <div className="flex items-center justify-between border-t border-border pt-4 mt-auto">
            <div className="font-medium text-foreground">
              ${vendor.priceMin.toLocaleString()} - ${vendor.priceMax.toLocaleString()}
            </div>
            <span className="text-sm text-primary font-medium group-hover:underline underline-offset-4">
              View Profile
            </span>
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}
