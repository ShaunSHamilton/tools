import { ExamEnvironmentConfig } from "@prisma/client";
import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface ConfigViewProps {
  config: ExamEnvironmentConfig;
  setConfig: (partialConfig: Partial<ExamEnvironmentConfig>) => void;
}

function AccordionItem({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div>
      <h4>
        <button
          className="flex w-full items-center text-teal-300 py-2"
          onClick={() => setOpen((v) => !v)}
        >
          <span className="flex-1 text-left">{title}</span>
          <ChevronDown
            className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </button>
      </h4>
      {open && <div className="p-2">{children}</div>}
    </div>
  );
}

export function ConfigView({ config, setConfig }: ConfigViewProps) {
  return (
    <>
      <AccordionItem title="Tag Config" defaultOpen>
        {config.tags?.map((tagConfig, index) => (
          <div key={index} className="tag-config-container mb-2">
            <p className="font-bold text-gray-100">
              Config {index + 1} ({tagConfig.numberOfQuestions} Questions)
            </p>
            {tagConfig.group.map((tag, inner) => (
              <span
                key={inner}
                className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-teal-500/20 text-teal-400 mr-1 mb-1"
              >
                {tag}
              </span>
            ))}
            <button
              aria-label="Remove"
              className="p-1 hover:bg-muted rounded text-red-400 ml-2"
              onClick={() => {
                setConfig({
                  tags: config.tags.filter((_, i) => i !== index),
                });
              }}
            >
              <span>&#10005;</span>
            </button>
          </div>
        ))}
      </AccordionItem>

      <AccordionItem title="Question Config">
        {config.questionSets.map((qt, index) => (
          <div key={index} className="tag-config-container mb-2">
            <p className="font-bold text-gray-100">{qt.type} Questions</p>
            <p className="text-gray-300 text-sm">
              Number of Type: {qt.numberOfSet}
            </p>
            <p className="text-gray-300 text-sm">
              Number of Questions: {qt.numberOfQuestions}
            </p>
            <p className="text-gray-300 text-sm">
              Number of Correct Answers: {qt.numberOfCorrectAnswers}
            </p>
            <p className="text-gray-300 text-sm">
              Number of Incorrect Answers: {qt.numberOfIncorrectAnswers}
            </p>
            <button
              className="bg-red-600 hover:bg-red-500 text-white text-xs px-3 py-1 rounded-md mt-1"
              onClick={() =>
                setConfig({
                  questionSets: config.questionSets.filter(
                    (_, i) => i !== index,
                  ),
                })
              }
            >
              Remove
            </button>
          </div>
        ))}
      </AccordionItem>
    </>
  );
}
