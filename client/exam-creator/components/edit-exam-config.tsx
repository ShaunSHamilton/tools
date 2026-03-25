import { type Dispatch, type SetStateAction, useState } from "react";
import {
  ExamCreatorExam,
  ExamEnvironmentChallenge,
  ExamEnvironmentConfig,
} from "@prisma/client";
import { UseQueryResult } from "@tanstack/react-query";
import { ObjectId } from "bson";

interface EditExamConfigProps {
  exam: ExamCreatorExam;
  setExam: (updates: Partial<ExamCreatorExam>) => void;
  config: ExamEnvironmentConfig;
  setConfig: (updates: Partial<ExamEnvironmentConfig>) => void;
  examEnvironmentChallengesQuery: UseQueryResult<
    ExamEnvironmentChallenge[],
    Error
  >;
  examEnvironmentChallenges: Omit<ExamEnvironmentChallenge, "id">[];
  setExamEnvironmentChallenges: Dispatch<
    SetStateAction<Omit<ExamEnvironmentChallenge, "id">[]>
  >;
}

export function EditExamConfig({
  exam,
  setExam,
  config,
  setConfig,
  examEnvironmentChallengesQuery,
  examEnvironmentChallenges,
  setExamEnvironmentChallenges,
}: EditExamConfigProps) {
  const [prereqInput, setPrereqInput] = useState("");
  const [challengeInput, setChallengeInput] = useState("");

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
      <div>
        <label className="text-sm font-medium text-primary block mb-1">Exam Name</label>
        <input
          type="text"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="Exam Name..."
          value={config.name}
          onChange={(e) =>
            setConfig({
              name: e.target.value,
            })
          }
        />
      </div>
      <div>
        <label className="text-sm font-medium text-primary block mb-1">Accessibility Note</label>
        <textarea
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
          placeholder="Accessibility Note..."
          value={config.note ?? ""}
          onChange={(e) =>
            setConfig({
              note: e.target.value,
            })
          }
        />
      </div>
      <div>
        <label className="text-sm font-medium text-primary block mb-1">Total Time [s]</label>
        <input
          type="number"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={config.totalTimeInS}
          onChange={(e) =>
            setConfig({
              totalTimeInS: Number(e.target.value),
            })
          }
          min={0}
        />
      </div>
      <div>
        <label className="text-sm font-medium text-primary block mb-1">Retake (Cooldown) Time [s]</label>
        <input
          type="number"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={config.retakeTimeInS}
          onChange={(e) =>
            setConfig({
              retakeTimeInS: Number(e.target.value),
            })
          }
          min={0}
        />
      </div>

      <div>
        <label className="text-sm font-medium text-primary block mb-1">Prerequisites</label>
        <input
          type="text"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mb-1"
          placeholder="Add ObjectID and press Enter"
          value={prereqInput || ""}
          onChange={(e) => setPrereqInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const value = prereqInput?.trim();
              if (
                value &&
                ObjectId.isValid(value) &&
                !exam.prerequisites.includes(value)
              ) {
                setExam({
                  prerequisites: [...exam.prerequisites, value],
                });
                setPrereqInput("");
              }
            }
          }}
        />
        <div className="bg-muted rounded-md px-2 py-1 min-h-[40px] max-h-[120px] overflow-y-auto flex flex-wrap items-start w-full">
          {exam.prerequisites?.map((id, idx) => (
            <span
              key={id}
              className="inline-flex items-center bg-teal-500 text-white rounded-md px-2 py-1 text-xs font-medium mr-2 mb-1"
            >
              <span className="mr-1.5">{id}</span>
              <button
                aria-label="Remove prerequisite"
                className="text-red-200 hover:text-red-100 ml-1"
                onClick={() => {
                  setExam({
                    prerequisites: exam.prerequisites.filter(
                      (_, i) => i !== idx,
                    ),
                  });
                }}
              >
                <span>&#x2715;</span>
              </button>
            </span>
          ))}
        </div>
        <p className="text-muted-foreground text-xs mt-1">
          Enter a 24-character hex ObjectID and press Enter to add. Click &#x2715; to
          remove.
        </p>
      </div>

      <div>
        <label className="text-sm font-medium text-primary block mb-1">Related Challenge IDs</label>
        {examEnvironmentChallengesQuery.isError && (
          <p className="text-red-400 text-xs mb-1">
            Error loading challenges:{" "}
            {examEnvironmentChallengesQuery.error.message}
          </p>
        )}
        <input
          type="text"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mb-1"
          placeholder="Add ObjectID and press Enter"
          value={challengeInput || ""}
          disabled={
            examEnvironmentChallengesQuery.isPending ||
            examEnvironmentChallengesQuery.isError
          }
          onChange={(e) => setChallengeInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              const value = challengeInput?.trim();
              if (
                value &&
                ObjectId.isValid(value) &&
                !examEnvironmentChallenges.some(
                  (ch) => ch.challengeId === value,
                )
              ) {
                setExamEnvironmentChallenges((prev) => [
                  ...prev,
                  { examId: exam.id, challengeId: value, version: 1 },
                ]);
                setChallengeInput("");
              }
            }
          }}
        />
        <div className="bg-muted rounded-md px-2 py-2 min-h-[40px] max-h-[120px] overflow-y-auto flex flex-wrap items-start w-full">
          {examEnvironmentChallengesQuery.isPending ? (
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />
          ) : (
            examEnvironmentChallenges.map(({ challengeId }, idx) => (
              <span
                key={challengeId}
                className="inline-flex items-center bg-teal-500 text-white rounded-md px-2 py-1 text-xs font-medium mr-2 mb-1"
              >
                <span className="mr-1.5">{challengeId}</span>
                <button
                  aria-label="Remove challenge id"
                  className="text-red-200 hover:text-red-100 ml-1"
                  onClick={() => {
                    setExamEnvironmentChallenges((prev) =>
                      prev.filter((_, i) => i !== idx),
                    );
                  }}
                >
                  <span>&#x2715;</span>
                </button>
              </span>
            ))
          )}
        </div>
        <p className="text-muted-foreground text-xs mt-1">
          Enter a 24-character hex ObjectID and press Enter to add. Click &#x2715; to
          remove.
        </p>
      </div>
      <div>
        <label className="text-sm font-medium text-primary block mb-1">Deprecated</label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={exam.deprecated}
            onChange={(e) =>
              setExam({
                deprecated: e.target.checked,
              })
            }
            className="h-4 w-4 accent-red-500 cursor-pointer"
          />
          <span className="text-sm">Deprecated</span>
        </label>
      </div>

      <div>
        <label className="text-sm font-medium text-primary block mb-1">Passing Percent [%]</label>
        <input
          type="number"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={config.passingPercent}
          onChange={(e) =>
            setConfig({
              passingPercent: Number(e.target.value),
            })
          }
          min={0}
          max={100}
        />
      </div>
    </div>
  );
}
