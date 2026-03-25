import {
  type ExamEnvironmentQuestionSet,
  type ExamEnvironmentGeneratedExam,
} from "@prisma/client";
import { Plus, X } from "lucide-react";

import {
  change_question_type,
  default_question,
  getBorderStyle,
  getQuestionStatus,
} from "../utils/question";
import { QuestionAccordion } from "./accordian";
import { MultipleChoiceForm } from "./multiple-choice-form";

type DialogueFormProps = {
  questionSet: ExamEnvironmentQuestionSet;
  questionSets: ExamEnvironmentQuestionSet[];
  setQuestionSets: (qs: ExamEnvironmentQuestionSet[]) => void;
  stagingExams: ExamEnvironmentGeneratedExam[] | undefined;
  productionExams: ExamEnvironmentGeneratedExam[] | undefined;
  isLoading: boolean;
  hasGeneratedExams: boolean;
};

export function DialogueForm({
  questionSet,
  questionSets,
  setQuestionSets,
  stagingExams,
  productionExams,
  isLoading,
  hasGeneratedExams,
}: DialogueFormProps) {
  return (
    <div className="rounded-lg p-1">
      <p className="font-bold text-teal-300 mb-1" id={questionSet.id}>
        Dialogue Form
      </p>
      <div className="flex flex-col gap-3">
        <div>
          <label className="text-sm font-medium">Dialogue</label>
          <textarea
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
            placeholder="Dialogue..."
            cols={30}
            rows={10}
            value={questionSet.context ?? ""}
            onChange={(e) =>
              change_question_type(
                {
                  ...questionSet,
                  context: e.target.value,
                },
                questionSets,
                setQuestionSets,
              )
            }
          />
        </div>
        <button
          className="text-red-400 hover:bg-muted px-3 py-1 rounded-md text-sm flex items-center gap-1 self-start"
          onClick={(e) => {
            e.preventDefault();
            setQuestionSets(
              questionSets.filter((qt) => qt.id !== questionSet.id),
            );
          }}
        >
          <X size={16} />
          Remove Dialogue
        </button>
        {questionSet.questions.map((question, index) => {
          const questionStatus = getQuestionStatus(
            question.id,
            stagingExams,
            productionExams,
          );
          const questionBorderStyle = getBorderStyle(
            questionStatus,
            isLoading,
            hasGeneratedExams,
          );

          return (
            <QuestionAccordion
              key={question.id}
              title={`Question ${index + 1}`}
              subtitle={question.text}
              {...questionBorderStyle}
            >
              <MultipleChoiceForm
                question={question}
                questionSet={questionSet}
                questionSets={questionSets}
                setQuestionSets={setQuestionSets}
                borderColor={questionBorderStyle.borderColor}
                borderStyle={questionBorderStyle.borderStyle}
                borderWidth={questionBorderStyle.borderWidth}
                stagingExams={stagingExams}
                productionExams={productionExams}
                isLoading={isLoading}
                hasGeneratedExams={hasGeneratedExams}
              />
            </QuestionAccordion>
          );
        })}
        <button
          className="bg-teal-600 hover:bg-teal-500 text-white px-3 py-1.5 rounded-md text-sm flex items-center gap-1"
          onClick={(e) => {
            e.preventDefault();
            change_question_type(
              {
                ...questionSet,
                questions: [...questionSet.questions, default_question()],
              },
              questionSets,
              setQuestionSets,
            );
          }}
        >
          <Plus size={16} />
          Add Question to Dialogue
        </button>
      </div>
    </div>
  );
}
