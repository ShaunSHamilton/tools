import { useEffect, useRef, useState } from "react";
import {
  type ExamEnvironmentMultipleChoiceQuestion,
  type ExamEnvironmentQuestionSet,
  type ExamEnvironmentGeneratedExam,
} from "@prisma/client";
import { Plus, X } from "lucide-react";

import {
  change_question,
  change_question_type,
  default_question_answer,
  default_question_audio,
  getAnswerStatus,
  getBorderStyle,
  parseMarkdown,
  remove_question,
} from "../utils/question";

type MultipleChoiceFormProps = {
  question: ExamEnvironmentMultipleChoiceQuestion;
  questionSet: ExamEnvironmentQuestionSet;
  questionSets: ExamEnvironmentQuestionSet[];
  setQuestionSets: (qs: ExamEnvironmentQuestionSet[]) => void;
  borderColor?: string;
  borderStyle?: string;
  borderWidth?: string;
  stagingExams?: ExamEnvironmentGeneratedExam[] | undefined;
  productionExams?: ExamEnvironmentGeneratedExam[] | undefined;
  isLoading?: boolean;
  hasGeneratedExams?: boolean;
};

function getBorderColorClass(borderColor: string) {
  if (borderColor === "green.400") return "border-green-400";
  if (borderColor === "yellow.400") return "border-yellow-400";
  if (borderColor === "red.400") return "border-red-400";
  return "border-gray-700";
}

function getBadgeBgClass(borderColor: string) {
  if (borderColor === "green.400") return "bg-green-500";
  if (borderColor === "yellow.400") return "bg-yellow-500";
  return "bg-red-500";
}

export function MultipleChoiceForm({
  question,
  questionSet,
  questionSets,
  setQuestionSets,
  borderColor = "gray.700",
  borderStyle = "solid",
  borderWidth: _borderWidth = "1px",
  stagingExams,
  productionExams,
  isLoading = false,
  hasGeneratedExams = false,
}: MultipleChoiceFormProps) {
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [isAudioVisible, setIsAudioVisible] = useState(false);
  const audioDebounceRef = useRef<number | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Without the audio observer debouncing,
        // it is possible to get stuck unable to scroll beyond the element,
        // because it pops in and out of existance - adjusting the page's frame
        if (audioDebounceRef.current) {
          clearTimeout(audioDebounceRef.current);
        }
        // @t/s-expect-error Nodejs type used for some reason
        audioDebounceRef.current = setTimeout(() => {
          if (entry.isIntersecting) {
            setIsAudioVisible(true);
          } else {
            setIsAudioVisible(false);
          }
        }, 250);
      },
      { threshold: 0.1 },
    );

    if (audioInputRef.current) {
      observer.observe(audioInputRef.current);
    }

    return () => {
      if (audioInputRef.current) {
        observer.unobserve(audioInputRef.current);
      }
    };
  }, []);

  return (
    <div
      className={`rounded-lg p-2 border ${getBorderColorClass(borderColor)}`}
      style={{ borderStyle }}
    >
      <p className="font-bold mb-2" id={question.id}>
        Multiple Choice Form
      </p>
      <div className="flex flex-col gap-3">
        <label className="flex items-center gap-2 self-end cursor-pointer">
          <input
            type="checkbox"
            className="rounded border-border"
            checked={question.deprecated}
            onChange={(e) => {
              change_question(
                {
                  ...question,
                  deprecated: e.target.checked,
                },
                questionSets,
                setQuestionSets,
              );
            }}
          />
          <span className="text-red-400">Deprecated</span>
        </label>
        <div>
          <label className="text-sm font-medium">Context</label>
          <textarea
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
            placeholder=""
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
        <div>
          <label className="text-sm font-medium">Question</label>
          <textarea
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
            placeholder="Text"
            value={question.text}
            onChange={(e) => {
              change_question(
                {
                  ...question,
                  text: e.target.value,
                },
                questionSets,
                setQuestionSets,
              );
            }}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Tags</label>
          <input
            type="text"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="tag_one,tag two,tag-three"
            value={question.tags.join(",")}
            onChange={(e) => {
              const tags = e.target.value.split(",").map((t) => t.trim());
              change_question(
                {
                  ...question,
                  tags,
                },
                questionSets,
                setQuestionSets,
              );
            }}
          />
        </div>
        <div>
          <label className="text-sm font-medium">Audio URL</label>
          <input
            type="text"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            placeholder="URL"
            ref={audioInputRef}
            value={question.audio?.url ?? ""}
            onChange={(e) => {
              const question_audio = question.audio ?? default_question_audio();
              const audio = {
                ...question_audio,
                url: e.target.value,
              };
              change_question(
                {
                  ...question,
                  audio,
                },
                questionSets,
                setQuestionSets,
              );
            }}
          />
        </div>
        {question.audio?.url && isAudioVisible && (
          <div className="rounded-md p-2 mt-2">
            <audio
              controls
              src={question.audio.url}
              style={{ width: "100%" }}
            />
          </div>
        )}
        <input
          type="text"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="Audio Captions"
          value={question.audio?.captions ?? ""}
          onChange={(e) => {
            const question_audio = question.audio ?? default_question_audio();
            const captions = e.target.value;
            const audio = {
              ...question_audio,
              captions,
            };
            change_question(
              {
                ...question,
                audio,
              },
              questionSets,
              setQuestionSets,
            );
          }}
        />
        <button
          className="border border-red-400 text-red-400 hover:bg-muted px-3 py-1 rounded-md text-sm flex items-center gap-1 self-start"
          onClick={(e) => {
            e.preventDefault();
            remove_question(question, questionSets, setQuestionSets);
          }}
        >
          <X size={16} />
          Remove Question
        </button>
        <h2 className="text-lg font-bold mt-4">Answers</h2>
        {question.answers.map((answer) => {
          const answerStatus = getAnswerStatus(
            answer.id,
            stagingExams,
            productionExams,
          );
          const answerBorderStyle = getBorderStyle(
            answerStatus,
            isLoading,
            hasGeneratedExams,
          );

          return (
            <div
              key={answer.id}
              className={`p-2 bg-muted rounded-md relative border ${
                answerBorderStyle.dualBorder
                  ? "border-0"
                  : getBorderColorClass(
                      answerBorderStyle.borderColor ?? "gray.700",
                    )
              }`}
              style={
                answerBorderStyle.dualBorder
                  ? {
                      boxShadow: `0 0 0 2px #ECC94B, 0 0 0 4px #48BB78`,
                    }
                  : { borderStyle: answerBorderStyle.borderStyle }
              }
            >
              {answerBorderStyle.dualBorder &&
              answerBorderStyle.stagingCount !== undefined &&
              answerBorderStyle.productionCount !== undefined ? (
                <div className="absolute -top-2 right-2 flex items-center gap-1 z-[1]">
                  <span className="bg-yellow-500 text-white text-xs px-1.5 py-0.5 rounded-md font-bold">
                    S:{answerBorderStyle.stagingCount}
                  </span>
                  <span className="bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-md font-bold">
                    P:{answerBorderStyle.productionCount}
                  </span>
                </div>
              ) : answerBorderStyle.generationCount !== undefined &&
                answerBorderStyle.generationCount > 0 ? (
                <span
                  className={`absolute -top-2 right-2 text-white text-xs px-2 py-0.5 rounded-md font-bold ${getBadgeBgClass(answerBorderStyle.borderColor ?? "red.400")}`}
                >
                  {answerBorderStyle.generationCount}
                </span>
              ) : null}
              <div
                className="answer-markdown mb-1"
                dangerouslySetInnerHTML={{ __html: parseMarkdown(answer.text) }}
              />
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[50px] mb-2"
                placeholder="Answer..."
                rows={2}
                value={answer.text}
                onChange={(e) => {
                  const updated_answer = {
                    ...answer,
                    text: e.target.value,
                  };
                  change_question(
                    {
                      ...question,
                      answers: question.answers.map((a) =>
                        a.id === answer.id ? updated_answer : a,
                      ),
                    },
                    questionSets,
                    setQuestionSets,
                  );
                }}
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-border"
                    checked={answer.isCorrect}
                    onChange={(e) => {
                      const updated_answer = {
                        ...answer,
                        isCorrect: e.target.checked,
                      };
                      change_question(
                        {
                          ...question,
                          answers: question.answers.map((a) =>
                            a.id === answer.id ? updated_answer : a,
                          ),
                        },
                        questionSets,
                        setQuestionSets,
                      );
                    }}
                  />
                  <span>Correct</span>
                </label>
                <button
                  aria-label="Remove answer"
                  className="p-1 hover:bg-muted rounded text-red-400"
                  onClick={(e) => {
                    e.preventDefault();
                    change_question(
                      {
                        ...question,
                        answers: question.answers.filter(
                          (a) => a.id !== answer.id,
                        ),
                      },
                      questionSets,
                      setQuestionSets,
                    );
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          );
        })}
        <div className="flex items-center">
          <button
            className="bg-teal-600 hover:bg-teal-500 text-white px-3 py-1.5 rounded-md text-sm flex items-center gap-1"
            onClick={(e) => {
              e.preventDefault();
              change_question(
                {
                  ...question,
                  answers: [...question.answers, default_question_answer()],
                },
                questionSets,
                setQuestionSets,
              );
            }}
          >
            <Plus size={16} />
            Add Answer
          </button>
        </div>
      </div>
    </div>
  );
}
