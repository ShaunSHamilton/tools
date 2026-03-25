import type {
  ExamEnvironmentConfig,
  ExamEnvironmentQuestionSet,
} from "@prisma/client";
import { useState } from "react";
import { X } from "lucide-react";

type TagConfigFormProps = {
  questionSets: ExamEnvironmentQuestionSet[];
  setConfig: (partialConfig: Partial<ExamEnvironmentConfig>) => void;
  config: ExamEnvironmentConfig;
};

export function TagConfigForm({
  questionSets,
  setConfig,
  config,
}: TagConfigFormProps) {
  const [isCreatingTagConfig, setIsCreatingTagConfig] = useState(false);
  const [selectedQuestionAmount, setSelectedQuestionAmount] = useState(1);
  const [currentTagSelectValue, setCurrentTagSelectValue] = useState("0");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  if (!isCreatingTagConfig) {
    return (
      <button
        className="border border-teal-500 text-teal-500 hover:bg-teal-500/10 rounded-md px-3 py-1 text-sm mt-2"
        onClick={() => setIsCreatingTagConfig(true)}
      >
        Create Tag Config
      </button>
    );
  }

  function generateTagOptions() {
    const tags = questionSets
      .map((q) => q.questions.map((q) => q.tags))
      .flat(2);

    const tagSet = new Set(tags);

    return Array.from(tagSet).map((tag) => (
      <option key={tag} value={tag}>
        {tag}
      </option>
    ));
  }

  const resetTagConfig = () => {
    setIsCreatingTagConfig(false);
    setCurrentTagSelectValue("0");
    setSelectedQuestionAmount(1);
    setSelectedTags([]);
  };

  const addSelectedTag = () => {
    const isAlreadySelected = selectedTags.includes(currentTagSelectValue);

    if (!isAlreadySelected && currentTagSelectValue !== "0") {
      setSelectedTags([...selectedTags, currentTagSelectValue]);
    }
  };

  const removeSelectedTag = (tag: string) => {
    setSelectedTags(selectedTags.filter((selectedTag) => selectedTag !== tag));
  };

  return (
    <div className="border border-primary rounded-lg p-4 mb-4 mt-2">
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {selectedTags.map((tag, index) => (
            <span
              key={index}
              className="inline-flex items-center bg-teal-500 text-white rounded-md px-2 py-1 text-xs font-medium"
            >
              {tag}
              <button
                aria-label="Remove tag"
                className="text-red-200 hover:text-red-100 ml-1"
                onClick={() => removeSelectedTag(tag)}
              >
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <select
            className="max-w-[200px] rounded-md border border-input bg-background px-2 py-1 text-sm"
            value={currentTagSelectValue}
            onChange={(e) => setCurrentTagSelectValue(e.target.value)}
          >
            <option value="0">Select Tag</option>
            {generateTagOptions()}
          </select>
          <button
            className="bg-teal-600 hover:bg-teal-500 text-white px-3 py-1 rounded-md text-sm disabled:opacity-50"
            onClick={addSelectedTag}
            disabled={currentTagSelectValue === "0"}
          >
            Add Tag
          </button>
        </div>
        <div>
          <label className="text-sm font-medium block mb-1">Number of Questions</label>
          <input
            type="number"
            className="max-w-[120px] rounded-md border border-input bg-background px-2 py-1 text-sm"
            min={1}
            value={selectedQuestionAmount}
            onChange={(e) => setSelectedQuestionAmount(Number(e.target.value))}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resetTagConfig}
            className="text-muted-foreground hover:text-foreground px-3 py-1 text-sm"
          >
            Cancel
          </button>
          <button
            className="bg-teal-600 hover:bg-teal-500 text-white px-3 py-1 rounded-md text-sm disabled:opacity-50"
            onClick={() => {
              setConfig({
                tags: [
                  ...config.tags,
                  {
                    group: selectedTags,
                    numberOfQuestions: selectedQuestionAmount,
                  },
                ],
              });
              resetTagConfig();
            }}
            disabled={selectedTags.length === 0}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
