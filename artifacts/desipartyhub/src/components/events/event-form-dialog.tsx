import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { PhotoField } from "@/components/ui/photo-field";
import { CitySuggestInput } from "@/components/ui/city-suggest-input";
import { useToast } from "@/hooks/use-toast";
import { useCreateEvent } from "@workspace/api-client-react";
import { EVENT_CATEGORIES } from "@/lib/event-categories";
import { EVENT_LANGUAGES } from "@/lib/event-languages";

const eventFormSchema = z.object({
  title: z.string().min(3, "Give the event a title"),
  description: z.string().min(10, "Add a short description (10+ characters)"),
  category: z.string().min(1, "Please choose a category"),
  city: z.string().min(1, "City is required"),
  state: z.string().min(1, "State is required"),
  venue: z.string().optional(),
  language: z.string().optional(),
  eventDate: z.string().min(1, "Event date is required"),
  endDate: z.string().optional(),
  imageUrl: z.string().optional(),
  ticketUrl: z.string().url("Enter a valid URL").optional().or(z.literal("")),
  additionalInfo: z.string().optional(),
  attachToBusiness: z.boolean().optional(),
});

type EventFormValues = z.infer<typeof eventFormSchema>;

const emptyDefaults = (city = "", state = ""): EventFormValues => ({
  title: "",
  description: "",
  category: "",
  city,
  state,
  venue: "",
  language: "",
  eventDate: "",
  endDate: "",
  imageUrl: "",
  ticketUrl: "",
  additionalInfo: "",
  attachToBusiness: false,
});

interface EventFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Called after a successful submit (e.g. to refetch "my events" lists).
  onSubmitted?: () => void;
  defaultCity?: string;
  defaultState?: string;
  // Only shown (as an "attach to business" checkbox) when the submitter is
  // a vendor with an approved listing - same as the vendor-dashboard flow.
  vendorClaim?: { vendorId: number; vendorName: string } | null;
}

// Shared "Submit an Event" dialog, used both from the vendor dashboard and
// directly from the public Events page - any signed-in account can submit
// one, since the backend only restricts unverified vendor accounts.
export function EventFormDialog({
  open,
  onOpenChange,
  onSubmitted,
  defaultCity = "",
  defaultState = "",
  vendorClaim,
}: EventFormDialogProps) {
  const { toast } = useToast();
  const createEvent = useCreateEvent();

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: emptyDefaults(defaultCity, defaultState),
  });

  useEffect(() => {
    if (open) {
      form.reset(emptyDefaults(defaultCity, defaultState));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onSubmit = (values: EventFormValues) => {
    const { attachToBusiness, ticketUrl, venue, endDate, language, additionalInfo, ...rest } = values;
    createEvent.mutate(
      {
        data: {
          ...rest,
          venue: venue || undefined,
          endDate: endDate || undefined,
          ticketUrl: ticketUrl || undefined,
          language: language || undefined,
          additionalInfo: additionalInfo || undefined,
          vendorId: attachToBusiness && vendorClaim ? vendorClaim.vendorId : undefined,
        } as any,
      },
      {
        onSuccess: () => {
          toast({ description: "Event submitted — an admin will review it shortly." });
          onOpenChange(false);
          onSubmitted?.();
        },
        onError: (err: any) => {
          toast({
            variant: "destructive",
            title: "Couldn't submit event",
            description: err?.data?.error || "Please check the form and try again.",
          });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submit an Event</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground -mt-2">
          Submitted events are reviewed by an admin before they appear publicly.
        </p>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem><FormLabel>Event Title</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || undefined}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Choose a category" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {EVENT_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City</FormLabel>
                    <FormControl>
                      <CitySuggestInput
                        value={field.value}
                        onChange={field.onChange}
                        onCitySelect={(selectedCity, selectedState) => {
                          form.setValue("city", selectedCity, { shouldValidate: true });
                          form.setValue("state", selectedState, { shouldValidate: true });
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem><FormLabel>State</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="venue"
              render={({ field }) => (
                <FormItem><FormLabel>Venue <span className="text-xs text-muted-foreground font-normal">(optional)</span></FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="language"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Language <span className="text-xs text-muted-foreground font-normal">(optional)</span></FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || undefined}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Choose a language" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {EVENT_LANGUAGES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="eventDate"
                render={({ field }) => (
                  <FormItem><FormLabel>Starts</FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem><FormLabel>Ends <span className="text-xs text-muted-foreground font-normal">(optional)</span></FormLabel><FormControl><Input type="datetime-local" {...field} /></FormControl><FormMessage /></FormItem>
                )}
              />
            </div>
            <PhotoField control={form.control} />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem><FormLabel>Description</FormLabel><FormControl><Textarea rows={3} {...field} /></FormControl><FormMessage /></FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="additionalInfo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Good to Know <span className="text-xs text-muted-foreground font-normal">(optional)</span></FormLabel>
                  <FormControl>
                    <Textarea rows={2} placeholder="Doors open time, parking, dress code, age restrictions..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="ticketUrl"
              render={({ field }) => (
                <FormItem><FormLabel>Tickets / More Info Link <span className="text-xs text-muted-foreground font-normal">(optional)</span></FormLabel><FormControl><Input placeholder="https://..." {...field} /></FormControl><FormMessage /></FormItem>
              )}
            />
            {vendorClaim && (
              <FormField
                control={form.control}
                name="attachToBusiness"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-2 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="font-normal">
                      This event is hosted by {vendorClaim.vendorName}
                    </FormLabel>
                  </FormItem>
                )}
              />
            )}

            <Button type="submit" className="w-full" disabled={createEvent.isPending}>
              {createEvent.isPending ? "Submitting..." : "Submit for Review"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
