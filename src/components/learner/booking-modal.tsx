"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useMediaQuery } from "@/hooks/use-media-query";
import { LiveSessionBookingUI } from "./booking-ui";

type BookingModalProps = {
  serviceId: string;
  trigger: React.ReactElement;
  onSuccess?: () => void;
};

export function BookingModal({ serviceId, trigger, onSuccess }: BookingModalProps) {
  const [open, setOpen] = React.useState(false);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const handleSuccess = () => {
    onSuccess?.();
    // Keep open to show success state in UI
  };

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={trigger} />
        <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden rounded-[2.5rem] border-none shadow-2xl">
          <LiveSessionBookingUI 
            serviceId={serviceId} 
            onSuccess={handleSuccess} 
            onClose={() => setOpen(false)} 
          />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={trigger} />
      <SheetContent side="bottom" className="p-0 h-[85vh] rounded-t-[2.5rem] overflow-hidden border-none shadow-2xl">
        <LiveSessionBookingUI 
          serviceId={serviceId} 
          onSuccess={handleSuccess} 
          onClose={() => setOpen(false)} 
        />
      </SheetContent>
    </Sheet>
  );
}
