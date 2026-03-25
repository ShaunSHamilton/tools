import React, { useState } from "react";
import { parseMarkdown } from "../utils/question";
import { ChevronDown, ChevronUp } from "lucide-react";

type AccordionProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  borderColor?: string;
  borderStyle?: string;
  borderWidth?: string;
  generationCount?: number;
  isLoading?: boolean;
  dualBorder?: boolean;
  stagingCount?: number;
  productionCount?: number;
};

export function QuestionAccordion({
  title,
  subtitle,
  children,
  borderColor = "bg.muted",
  borderStyle = "solid",
  borderWidth: _borderWidth = "1px",
  generationCount,
  isLoading = false,
  dualBorder = false,
  stagingCount,
  productionCount,
}: AccordionProps) {
  const [open, setOpen] = useState(false);
  const onToggle = () => setOpen((v) => !v);

  function getBadgeBgClass() {
    if (borderColor === "green.400") return "bg-green-500";
    if (borderColor === "yellow.400") return "bg-yellow-500";
    return "bg-red-500";
  }

  function getBorderColorClass() {
    if (borderColor === "green.400") return "border-green-400";
    if (borderColor === "yellow.400") return "border-yellow-400";
    if (borderColor === "red.400") return "border-red-400";
    return "border-border";
  }

  return (
    <div className="relative mt-1">
      {isLoading && (
        <div
          className="absolute -inset-0.5 rounded-xl pointer-events-none z-0 animate-spin-slow"
          style={{
            background: `repeating-linear-gradient(
              45deg,
              transparent,
              transparent 10px,
              ${borderColor === "green.400" ? "#4ade80" : borderColor === "yellow.400" ? "#facc15" : borderColor === "red.400" ? "#f87171" : "#6b7280"} 10px,
              ${borderColor === "green.400" ? "#4ade80" : borderColor === "yellow.400" ? "#facc15" : borderColor === "red.400" ? "#f87171" : "#6b7280"} 20px
            )`,
            animation: "spin 3s linear infinite",
          }}
        />
      )}
      <div
        className={`rounded-xl shadow-md relative z-[1] bg-card ${
          isLoading ? "border-0" : `border ${getBorderColorClass()}`
        }`}
        style={
          dualBorder
            ? {
                boxShadow: `0 0 0 3px #ECC94B, 0 0 0 6px #48BB78`,
                borderWidth: "0",
              }
            : { borderStyle }
        }
      >
        {dualBorder &&
        stagingCount !== undefined &&
        productionCount !== undefined ? (
          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 flex items-center gap-1 z-[1]">
            <span className="inline-flex items-center rounded-md bg-yellow-500 text-white text-xs font-medium px-2">
              S: {stagingCount}
            </span>
            <span className="inline-flex items-center rounded-md bg-green-500 text-white text-xs font-medium px-2">
              P: {productionCount}
            </span>
          </div>
        ) : generationCount !== undefined && generationCount > 0 ? (
          <span
            className={`absolute -top-2.5 left-1/2 -translate-x-1/2 inline-flex items-center rounded-md text-white text-xs font-medium px-2 z-[1] ${getBadgeBgClass()}`}
          >
            {generationCount} {generationCount === 1 ? "exam" : "exams"}
          </span>
        ) : null}
        <div
          className="px-4 py-3 cursor-pointer hover:bg-gray-700 rounded-t-xl"
          onClick={onToggle}
        >
          <div className="flex items-center justify-between">
            <div className="max-w-full overflow-x-auto">
              <h3 className="text-teal-400 font-bold text-base max-w-full">
                {title}
              </h3>
              <div
                className="text-sm whitespace-pre-line"
                dangerouslySetInnerHTML={{ __html: parseMarkdown(subtitle) }}
              />
            </div>
            <button
              aria-label={open ? "Collapse" : "Expand"}
              className="p-1 hover:bg-muted rounded text-teal-400 ml-2"
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
            >
              {open ? <ChevronUp /> : <ChevronDown />}
            </button>
          </div>
        </div>
        {open && <div className="px-4 pb-4">{children}</div>}
      </div>
    </div>
  );
}
