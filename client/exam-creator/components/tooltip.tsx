import * as React from "react";
import { Tooltip as TooltipPrimitive } from "radix-ui";

export interface TooltipProps {
  showArrow?: boolean;
  children: React.ReactNode;
  content: React.ReactNode;
  disabled?: boolean;
  [key: string]: any;
}

export const Tooltip = React.forwardRef<HTMLDivElement, TooltipProps>(
  function Tooltip(props, _ref) {
    const { showArrow = true, children, disabled, content } = props;

    if (disabled) return <>{children}</>;

    return (
      <TooltipPrimitive.Provider delayDuration={200}>
        <TooltipPrimitive.Root>
          <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
          <TooltipPrimitive.Portal>
            <TooltipPrimitive.Content
              className="z-50 rounded-md bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md border border-border animate-in fade-in-0 zoom-in-95"
              sideOffset={5}
            >
              {content}
              {showArrow && <TooltipPrimitive.Arrow className="fill-popover" />}
            </TooltipPrimitive.Content>
          </TooltipPrimitive.Portal>
        </TooltipPrimitive.Root>
      </TooltipPrimitive.Provider>
    );
  },
);
