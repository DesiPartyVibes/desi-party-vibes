import { useState } from "react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

// Resizes/compresses an uploaded image client-side and returns it as a JPEG
// data URL. There's no object-storage service wired up in this app, and the
// relevant image_url columns are plain text fields, so a compressed data URL
// is the simplest path that needs no new backend work.
export async function processImageFile(file: File): Promise<string> {
  const rawDataUrl: string = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Couldn't decode that image."));
    el.src = rawDataUrl;
  });

  const maxDim = 1200;
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image processing isn't supported in this browser.");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

// Shared photo field for the vendor register/edit/event forms: lets someone
// upload a photo (resized+compressed client-side into the imageUrl field) or
// fall back to pasting a URL directly.
export function PhotoField({ control, label = "Photo" }: { control: any; label?: string }) {
  const [mode, setMode] = useState<"upload" | "url">("upload");
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <FormField
      control={control}
      name="imageUrl"
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          {mode === "upload" ? (
            <div className="space-y-2">
              <FormControl>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    setError(null);
                    if (!file.type.startsWith("image/")) {
                      setError("Please choose an image file.");
                      return;
                    }
                    if (file.size > 8 * 1024 * 1024) {
                      setError("Image is too large (max 8MB).");
                      return;
                    }
                    setIsProcessing(true);
                    try {
                      field.onChange(await processImageFile(file));
                    } catch (err: any) {
                      setError(err?.message || "Couldn't process that image. Try a different file.");
                    } finally {
                      setIsProcessing(false);
                    }
                  }}
                />
              </FormControl>
              {isProcessing && <p className="text-xs text-muted-foreground">Processing image...</p>}
              {error && <p className="text-xs text-destructive">{error}</p>}
              {field.value && !isProcessing && (
                <img src={field.value} alt="Preview" className="h-24 w-24 rounded-md object-cover border" />
              )}
              <button
                type="button"
                className="text-xs text-muted-foreground underline underline-offset-2"
                onClick={() => setMode("url")}
              >
                Or paste an image URL instead
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <FormControl>
                <Input placeholder="https://..." {...field} />
              </FormControl>
              <button
                type="button"
                className="text-xs text-muted-foreground underline underline-offset-2"
                onClick={() => setMode("upload")}
              >
                Or upload a photo instead
              </button>
            </div>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
