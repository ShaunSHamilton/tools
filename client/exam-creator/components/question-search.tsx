import React, { useState } from "react";
import { Search as GiMagnifyingGlass } from "lucide-react";
import type { ExamCreatorExam } from "@prisma/client";

type QuestionSearchProps = {
  exam: ExamCreatorExam;
  searchIds: string[];
  setSearchIds: (ids: string[]) => void;
};

export function QuestionSearch({
  exam,
  searchIds,
  setSearchIds,
}: QuestionSearchProps) {
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const handleSearchToggle = () => {
    setSearchVisible((v) => !v);
    setSearchTerm("");
    setSearchIds([]);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  function findIdsOfNearestMatches(searchTerm: string): string[] {
    const closestIds: string[] = [];
    const searchRegex = new RegExp(searchTerm, "i");
    const questionSets = exam.questionSets;

    outer: for (const questionSet of questionSets) {
      const questionSetText = questionSet.context;
      const questions = questionSet.questions;

      const questionSetTextMatch = searchRegex.exec(questionSetText ?? "");
      if (questionSetTextMatch) {
        closestIds.push(questionSet.id);
        continue outer;
      }

      for (const question of questions) {
        const questionText = question.text;
        const answers = question.answers;
        const questionTextMatch = searchRegex.exec(questionText);

        if (questionTextMatch) {
          closestIds.push(question.id);
          continue outer;
        }

        for (const answer of answers) {
          const answerText = answer.text;
          const answerTextMatch = searchRegex.exec(answerText);
          if (answerTextMatch) {
            closestIds.push(question.id);
            continue outer;
          }
        }

        for (const tag of question.tags) {
          const tagMatch = searchRegex.exec(tag);
          if (tagMatch) {
            closestIds.push(question.id);
            continue outer;
          }
        }
      }
    }
    return closestIds;
  }

  const handleSearchKeyPress = (
    event: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Enter") {
      setSearchIds(findIdsOfNearestMatches(searchTerm));
    }
  };

  return (
    <div className="relative mb-4">
      <div className="flex items-center gap-2">
        <button
          aria-label="Search"
          className={`p-1.5 rounded-md text-sm ${
            searchVisible
              ? "bg-teal-600 text-white"
              : "text-teal-500 hover:bg-teal-500/10"
          }`}
          onClick={handleSearchToggle}
        >
          <GiMagnifyingGlass />
        </button>
        <div>
          <input
            className="w-[220px] rounded-md border border-primary bg-muted text-foreground px-2 py-1 text-sm placeholder:text-muted-foreground mr-2"
            placeholder="Search Questions..."
            value={searchTerm}
            onChange={handleSearchChange}
            onKeyDown={handleSearchKeyPress}
            autoFocus
          />
          <button
            aria-label="Close search"
            className="text-muted-foreground hover:text-foreground ml-2 text-sm"
            onClick={handleSearchToggle}
          >
            &times;
          </button>
          {(searchIds.length > 0 || searchTerm.length !== 0) && (
            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-teal-500/20 text-teal-400 ml-2">
              {searchIds.length} found
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
