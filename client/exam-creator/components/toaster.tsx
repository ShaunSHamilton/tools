import { toast } from "sonner";

/**
 * Compatibility layer: replaces the old Chakra toaster with sonner.
 * Existing call-sites use `toaster.create({ title, description, type, ... })`.
 */
export const toaster = {
  create({
    title,
    description,
    type,
    duration,
  }: {
    title?: string;
    description?: string;
    type?: "success" | "error" | "warning" | "loading" | "info";
    duration?: number;
    closable?: boolean;
  }) {
    const opts = { description, duration };
    switch (type) {
      case "success":
        return toast.success(title, opts);
      case "error":
        return toast.error(title, opts);
      case "warning":
        return toast.warning(title, opts);
      case "loading":
        return toast.loading(title, opts);
      case "info":
      default:
        return toast(title, opts);
    }
  },
};
