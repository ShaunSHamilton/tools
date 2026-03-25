import {
  type ExamEnvironmentConfig,
  type ExamEnvironmentQuestionSet,
  type ExamEnvironmentQuestionType,
} from "@prisma/client";
import { useState } from "react";

type QuestionTypeConfigFormProps = {
  questionSets: ExamEnvironmentQuestionSet[];
  setConfig: (partialConfig: Partial<ExamEnvironmentConfig>) => void;
  config: ExamEnvironmentConfig;
};

export function QuestionTypeConfigForm({
  questionSets,
  setConfig,
  config,
}: QuestionTypeConfigFormProps) {
  const [selectedQuestionType, setSelectedQuestionType] =
    useState<ExamEnvironmentQuestionType>();
  const [isCreatingQuestionTypeConfig, setIsCreatingQuestionTypeConfig] =
    useState(false);
  const [numberOfSet, setNumberOfSet] = useState(1);
  const [numberOfQuestions, setNumberOfQuestions] = useState(1);
  const [numberOfCorrectAnswers, setNumberOfCorrectAnswers] = useState(1);
  const [numberOfIncorrectAnswers, setNumberOfIncorrectAnswers] = useState(0);

  const options = questionSets.reduce((acc, curr) => {
    if (!acc.includes(curr.type)) {
      return [...acc, curr.type];
    }
    return acc;
  }, [] as ExamEnvironmentQuestionType[]);

  if (!isCreatingQuestionTypeConfig) {
    return (
      <button
        className="border border-teal-500 text-teal-500 hover:bg-teal-500/10 rounded-md px-3 py-1 text-sm mt-2"
        onClick={() => setIsCreatingQuestionTypeConfig(true)}
      >
        Create Question Type Config
      </button>
    );
  }

  return (
    <div className="border border-primary rounded-lg p-4 mb-4 mt-2">
      <div className="flex flex-col gap-3">
        <div>
          <label className="text-sm font-medium block mb-1">Question Type</label>
          <select
            className="max-w-[200px] rounded-md border border-input bg-background px-2 py-1 text-sm"
            value={selectedQuestionType ?? ""}
            onChange={(e) =>
              setSelectedQuestionType(
                e.target.value as ExamEnvironmentQuestionType,
              )
            }
          >
            <option value="">Select Question Type</option>
            {options.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">Number of Type</label>
          <input
            type="number"
            className="max-w-[120px] rounded-md border border-input bg-background px-2 py-1 text-sm"
            min={1}
            value={numberOfSet}
            onChange={(e) => setNumberOfSet(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">Number of Questions</label>
          <input
            type="number"
            className="max-w-[120px] rounded-md border border-input bg-background px-2 py-1 text-sm"
            min={1}
            value={numberOfQuestions}
            onChange={(e) => setNumberOfQuestions(Number(e.target.value))}
            max={selectedQuestionType === "MultipleChoice" ? 1 : undefined}
          />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">Number of Correct Answers</label>
          <input
            type="number"
            className="max-w-[120px] rounded-md border border-input bg-background px-2 py-1 text-sm"
            min={1}
            value={numberOfCorrectAnswers}
            onChange={(e) => setNumberOfCorrectAnswers(Number(e.target.value))}
          />
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">Number of Incorrect Answers</label>
          <input
            type="number"
            className="max-w-[120px] rounded-md border border-input bg-background px-2 py-1 text-sm"
            min={0}
            value={numberOfIncorrectAnswers}
            onChange={(e) => setNumberOfIncorrectAnswers(Number(e.target.value))}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCreatingQuestionTypeConfig(false)}
            className="text-muted-foreground hover:text-foreground px-3 py-1 text-sm"
          >
            Cancel
          </button>
          <button
            className="bg-teal-600 hover:bg-teal-500 text-white px-3 py-1 rounded-md text-sm disabled:opacity-50"
            onClick={() => {
              if (!selectedQuestionType) return;
              setConfig({
                questionSets: [
                  ...config.questionSets,
                  {
                    type: selectedQuestionType,
                    numberOfSet,
                    numberOfQuestions,
                    numberOfCorrectAnswers,
                    numberOfIncorrectAnswers,
                  },
                ],
              });
              setIsCreatingQuestionTypeConfig(false);
            }}
            disabled={!selectedQuestionType}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
