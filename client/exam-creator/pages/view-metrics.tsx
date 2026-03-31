import { useContext, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import type {
  ExamCreatorExam,
  ExamEnvironmentAnswer,
  ExamEnvironmentExamAttempt,
  ExamEnvironmentGeneratedExam,
  ExamEnvironmentMultipleChoiceQuestion,
  ExamEnvironmentQuestionSet,
} from "@prisma/client";

import { getExamMetricsById } from "../utils/fetch";
import { UsersWebSocketActivityContext } from "../contexts/users-websocket";
import { AuthContext } from "../contexts/auth";
import { parseMarkdown, secondsToHumanReadable } from "../utils/question";
import { TimeTakenDistribution } from "../components/time-taken-distribution";
import { Tooltip } from "../components/tooltip";
import { TitleStat } from "../components/ui/title-stat";
import { NavBar } from "@/components/nav-bar";

export function View() {
  const { id } = useParams({ from: "/exam-creator/metrics/exams/$id" });
  const { user, logout } = useContext(AuthContext)!;

  const examMetricsQuery = useQuery({
    queryKey: ["metrics", id],
    enabled: !!user,
    queryFn: () => getExamMetricsById(id!),
    retry: false,
    refetchOnWindowFocus: false,
  });

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar
        appName="Exam Creator"
        color="teal"
        appHref="/exam-creator"
        userName={user?.name}
        onLogout={logout}
      />
      <div className="py-8 px-2 flex-1">
      <div className="flex items-center justify-center">
        {examMetricsQuery.isFetching || examMetricsQuery.isPending ? (
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-teal-400 border-t-transparent" />
        ) : examMetricsQuery.isError ? (
          <p className="text-red-400 text-lg">
            Error loading exam: {examMetricsQuery.error.message}
          </p>
        ) : (
          <ViewExamMetrics
            exam={examMetricsQuery.data.exam}
            attempts={examMetricsQuery.data.attempts}
            generations={examMetricsQuery.data.generations}
          />
        )}
      </div>
      </div>
    </div>
  );
}

interface ViewExamMetricsProps {
  exam: ExamCreatorExam;
  attempts: ExamEnvironmentExamAttempt[];
  generations: ExamEnvironmentGeneratedExam[];
}

function ViewExamMetrics({
  exam,
  attempts,
  generations,
}: ViewExamMetricsProps) {
  const { updateActivity } = useContext(UsersWebSocketActivityContext)!;
  const [sigma, setSigma] = useState(50);
  const [minAttemptTimeInS, setMinAttemptTimeInS] = useState<number>(0);
  const [minQuestionsAnswered, setMinQuestionsAnswered] = useState<number>(0);

  const filteredAttemptsQuery = useQuery({
    queryKey: [
      "filtered-attempts",
      exam.id,
      minAttemptTimeInS,
      minQuestionsAnswered,
    ],
    queryFn: () => {
      const filteredAttempts = attempts.filter((a) => {
        const startTimeInMS = a.startTime.getTime();
        const flattened = a.questionSets.flatMap((qs) => qs.questions);

        const questionsAnswered = flattened.filter(
          (f) => !!f.submissionTime,
        ).length;
        if (questionsAnswered < minQuestionsAnswered) {
          return false;
        }

        const lastSubmission = Math.max(
          ...flattened.map((f) => f.submissionTime?.getTime() ?? 0),
        );
        const timeToComplete = (lastSubmission - startTimeInMS) / 1000;

        return timeToComplete > minAttemptTimeInS;
      });
      return filteredAttempts;
    },
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    updateActivity({
      page: new URL(window.location.href),
      lastActive: Date.now(),
    });

    return () => {
      updateActivity({
        page: new URL(window.location.href),
        lastActive: Date.now(),
      });
    };
  }, [exam]);

  function handleNumberChange(
    n: number,
    setter: React.Dispatch<React.SetStateAction<number>>,
  ) {
    if (isNaN(n) || n < 0) {
      setter(0);
    } else {
      setter(n);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-8 w-full max-w-7xl">
        <div className="rounded-xl shadow-lg p-8 mb-4 w-full">
          <h2 className="font-extrabold text-2xl mb-2">
            {exam.config.name}
          </h2>
          <hr className="my-4 border-border" />
          <h3 className="text-lg font-semibold mt-4 mb-2">
            Exam Metrics
          </h3>
          <p className="text-muted-foreground mb-2">
            This is the analysis of the exam attempts:
          </p>

          <h4 className="text-base font-semibold col-span-3">
            Adjust Histogram Parameters
          </h4>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-6 mb-4 mt-2">
            <div>
              <Tooltip content="Minimum attempt time in seconds to include in the distribution">
                <label className="text-sm font-medium text-muted-foreground block mb-1">Min Attempt Time [s]</label>
              </Tooltip>
              <input
                type="number"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                defaultValue={0}
                min={0}
                onBlur={(e) => handleNumberChange(Number(e.target.value), setMinAttemptTimeInS)}
              />
            </div>
            <div>
              <Tooltip content="Minimum number of questions answered to include in the distribution">
                <label className="text-sm font-medium text-muted-foreground block mb-1">
                  Min Questions Answered [#]
                </label>
              </Tooltip>
              <input
                type="number"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                defaultValue={0}
                min={0}
                onBlur={(e) => handleNumberChange(Number(e.target.value), setMinQuestionsAnswered)}
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Sigma</label>
              <input
                type="number"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                defaultValue={50}
                min={1}
                onBlur={(e) => handleNumberChange(Number(e.target.value), setSigma)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Adjust how many brackets are used in the histogram
              </p>
            </div>
          </div>

          {filteredAttemptsQuery.isFetching || !filteredAttemptsQuery.data ? (
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-teal-400 border-t-transparent" />
          ) : filteredAttemptsQuery.isError ? (
            <p className="text-red-400">
              Error filtering attempts: {filteredAttemptsQuery.error.message}
            </p>
          ) : (
            <>
              <AttemptStats attempts={filteredAttemptsQuery.data} />
              <hr className="my-2 border-border" />
              <TimeTakenDistribution
                attempts={filteredAttemptsQuery.data}
                exam={exam}
                sigma={sigma}
              />

              <hr className="my-4 border-border" />
              <h3 className="text-lg font-semibold mt-8 mb-2" id="exam-questions">
                Exam Questions
              </h3>
              <p className="text-muted-foreground mb-2">
                View the exam questions along with how often each question and
                answer were seen and submitted.
              </p>
              <div className="rounded-lg p-2 mt-2">
                <QuestionsView
                  {...{
                    exam,
                    attempts: filteredAttemptsQuery.data,
                    generations,
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function AttemptStats({
  attempts,
}: {
  attempts: ExamEnvironmentExamAttempt[];
}) {
  const statsQuery = useQuery({
    queryKey: ["attempt-stats", attempts],
    queryFn: async () => {
      const sampledAttempts = attempts.length;

      const avg = attempts.reduce(
        (acc, attempt) => {
          const startTimeInMS = attempt.startTime.getTime();
          const flattened = attempt.questionSets.flatMap((qs) => qs.questions);

          if (flattened.length === 0) {
            return acc;
          }

          const answered = flattened.filter((f) => {
            return !!f.submissionTime;
          }).length;
          const lastSubmission = Math.max(
            ...flattened.map((f) => {
              return f.submissionTime?.getTime() ?? 0;
            }),
          );
          const timeToComplete = (lastSubmission - startTimeInMS) / 1000;

          const averageTimePerQuestion =
            answered > 0 ? timeToComplete / answered : 0;

          return {
            sumTimeSpent: acc.sumTimeSpent + timeToComplete,
            sumTimePerQuestion: acc.sumTimePerQuestion + averageTimePerQuestion,
          };
        },
        { sumTimeSpent: 0, sumTimePerQuestion: 0 },
      );

      const avgTimeSpent =
        sampledAttempts > 0 ? avg.sumTimeSpent / sampledAttempts : 0;
      const avgTimePerQuestion =
        sampledAttempts > 0 ? avg.sumTimePerQuestion / sampledAttempts : 0;
      return { sampledAttempts, avgTimeSpent, avgTimePerQuestion };
    },
    retry: false,
    refetchOnWindowFocus: false,
  });

  if (statsQuery.isPending) {
    return <div className="animate-spin rounded-full h-6 w-6 border-2 border-teal-400 border-t-transparent" />;
  }

  if (statsQuery.isError) {
    return (
      <p className="text-red-400">
        Error calculating attempt stats: {statsQuery.error.message}
      </p>
    );
  }

  const { sampledAttempts, avgTimeSpent, avgTimePerQuestion } = statsQuery.data;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
      <Tooltip content="Number of attempts included in this analysis after applying filters">
        <div className="rounded-lg shadow-md p-4 bg-card border border-border cursor-help">
          <div className="flex flex-col gap-2">
            <h4 className="text-sm font-semibold">Sampled Attempts</h4>
            <p className="text-2xl font-bold">{sampledAttempts}</p>
          </div>
        </div>
      </Tooltip>

      <Tooltip content="Average time from exam start to final question submission: sum(Final Submission Time - Start Time) / number of attempts">
        <div className="rounded-lg shadow-md p-4 bg-card border border-border cursor-help">
          <div className="flex flex-col gap-2">
            <h4 className="text-sm font-semibold">Average Time Spent</h4>
            <p className="text-2xl font-bold">
              {secondsToHumanReadable(Math.floor(avgTimeSpent))}
            </p>
          </div>
        </div>
      </Tooltip>

      <Tooltip content="Average time per question answered: sum(Question Submission Time) / total questions answered">
        <div className="rounded-lg shadow-md p-4 bg-card border border-border cursor-help">
          <div className="flex flex-col gap-1">
            <h4 className="text-sm font-semibold">Average Question Time</h4>
            <p className="text-2xl font-bold">
              {avgTimePerQuestion.toFixed(2)}s
            </p>
          </div>
        </div>
      </Tooltip>
    </div>
  );
}

function QuestionsView({ exam, attempts, generations }: ViewExamMetricsProps) {
  const [sortKey, setSortKey] = useState<
    "difficulty" | "exam" | "time-spent" | "correct" | "submitted-by"
  >("difficulty");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Pre-calculate all questions with their stats to get min/max difficulty
  const questionsWithStats = (() => {
    const noDifficulty = exam.questionSets
      .flatMap((qs) =>
        qs.questions.map((q) => ({
          ...q,
          context: qs.context,
        })),
      )
      .map((q, i) => {
        const seenBy = attempts.filter((attempt) => {
          const generation = generations.find(
            (gen) => gen.id === attempt.generatedExamId,
          );
          if (!generation) return false;
          return generation.questionSets
            .flatMap((gqs) => gqs.questions.map((q) => q.id))
            .includes(q.id);
        }).length;

        const attemptsWhoSubmittedQuestion = attempts.filter((attempt) => {
          const submittedQuestion = attempt.questionSets
            .flatMap((aqs) => aqs.questions)
            .find((aq) => aq.id === q.id);
          return !!submittedQuestion;
        });

        const submittedBy = attemptsWhoSubmittedQuestion.length;

        const timeSpents = attemptsWhoSubmittedQuestion.reduce(
          (acc, attempt) => {
            const flattenedQuestions = attempt.questionSets
              .flatMap((aqs) => aqs.questions)
              .sort((a, b) => {
                const aTime = a.submissionTime
                  ? a.submissionTime.getTime()
                  : Infinity;
                const bTime = b.submissionTime
                  ? b.submissionTime.getTime()
                  : Infinity;
                return aTime - bTime;
              });

            const questionIndex = flattenedQuestions.findIndex(
              (fq) => fq.id === q.id,
            );
            if (questionIndex === -1) {
              return acc;
            }

            const question = flattenedQuestions[questionIndex];
            const submissionTime = question.submissionTime.getTime();

            let previousTime =
              questionIndex === 0
                ? attempt.startTime.getTime()
                : flattenedQuestions[
                    questionIndex - 1
                  ].submissionTime.getTime();

            const timeSpentOnQuestion = (submissionTime - previousTime) / 1000;

            acc.push(timeSpentOnQuestion);
            return acc;
          },
          [] as number[],
        );

        const totalTimeSpent = timeSpents.reduce((acc, t) => {
          return acc + t;
        }, 0);

        const timeSpent =
          timeSpents.length > 0 ? totalTimeSpent / timeSpents.length : 0;

        const percentageCorrect =
          (attempts.filter((attempt) => {
            const submittedQuestion = attempt.questionSets
              .flatMap((aqs) => aqs.questions)
              .find((aq) => aq.id === q.id);
            if (!submittedQuestion) return false;
            const selectedCorrectAnswer = submittedQuestion.answers
              .map((aid) =>
                q.answers.find((qa) => qa.id === aid && qa.isCorrect),
              )
              .filter((a) => !!a);
            return selectedCorrectAnswer.length > 0;
          }).length /
            Math.max(submittedBy, 1)) *
          100;

        const answers = q.answers.map((answer) => {
          const seenBy = attempts.filter((attempt) => {
            const generation = generations.find(
              (gen) => gen.id === attempt.generatedExamId,
            );
            if (!generation) return false;
            return generation.questionSets
              .flatMap((gqs) => gqs.questions.flatMap((qqs) => qqs.answers))
              .includes(answer.id);
          }).length;

          const submittedBy = attempts.filter((attempt) => {
            const attemptAnswers = attempt.questionSets.flatMap((aqs) =>
              aqs.questions.flatMap((aq) => aq.answers),
            );
            return attemptAnswers.includes(answer.id);
          }).length;

          return {
            ...answer,
            stats: {
              seenBy,
              submittedBy,
            },
          };
        });

        return {
          ...q,
          stats: {
            seenBy,
            submittedBy,
            timeSpent,
            percentageCorrect,
          },
          answers,
          i,
        };
      });

    let maxTimeSpent = 0;
    let minTimeSpent = Infinity;

    for (const q of noDifficulty) {
      if (q.stats.timeSpent > maxTimeSpent) {
        maxTimeSpent = q.stats.timeSpent;
      }
      if (q.stats.timeSpent < minTimeSpent) {
        minTimeSpent = q.stats.timeSpent;
      }
    }

    const withDifficulty = noDifficulty.map((q) => {
      const normalizedTimeSpent =
        (q.stats.timeSpent - minTimeSpent) / (maxTimeSpent - minTimeSpent);
      const difficulty =
        normalizedTimeSpent / (q.stats.percentageCorrect / 100 + 1);

      return {
        ...q,
        stats: {
          ...q.stats,
          difficulty,
        },
      };
    });

    return withDifficulty;
  })();

  const difficulties = questionsWithStats
    .map((q) => q.stats.difficulty)
    .filter((d) => !isNaN(d));
  const minDifficulty = difficulties.length > 0 ? Math.min(...difficulties) : 0;
  const maxDifficulty = difficulties.length > 0 ? Math.max(...difficulties) : 0;

  return (
    <div className="rounded-lg mb-4">
      <div className="flex flex-col gap-4">
        <div>
          <h4 className="text-base font-semibold mb-3">
            Questions Overview
          </h4>
          <div className="flex flex-row justify-center">
            <Tooltip content="Lowest difficulty score among all questions">
              <TitleStat
                title="Min Difficulty"
                stat={minDifficulty.toFixed(2)}
              />
            </Tooltip>
            <Tooltip content="Highest difficulty score among all questions">
              <TitleStat
                title="Max Difficulty"
                stat={maxDifficulty.toFixed(2)}
              />
            </Tooltip>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-bold block mb-1">Sort By</label>
              <select
                value={sortKey}
                onChange={(e) =>
                  setSortKey(
                    e.target.value as
                      | "difficulty"
                      | "exam"
                      | "time-spent"
                      | "correct"
                      | "submitted-by",
                  )
                }
                className="w-full p-2 rounded-md bg-background text-foreground border border-input"
              >
                <option value="difficulty">Difficulty</option>
                <option value="exam">Exam Order</option>
                <option value="time-spent">Time Spent</option>
                <option value="correct">Correct %</option>
                <option value="submitted-by">Submitted By</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-bold block mb-1 text-muted-foreground">Order</label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
                className="w-full p-2 rounded-md bg-background text-foreground border border-input"
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {questionsWithStats
            .sort((a, b) => {
              if (sortKey === "exam") {
                return sortOrder === "asc"
                  ? (a as any).examOrder - (b as any).examOrder
                  : (b as any).examOrder - (a as any).examOrder;
              }

              if (sortKey === "time-spent") {
                const ta = a.stats.timeSpent || 0;
                const tb = b.stats.timeSpent || 0;
                return sortOrder === "asc" ? ta - tb : tb - ta;
              }

              if (sortKey === "correct") {
                const ca = a.stats.percentageCorrect || 0;
                const cb = b.stats.percentageCorrect || 0;
                return sortOrder === "asc" ? ca - cb : cb - ca;
              }

              if (sortKey === "submitted-by") {
                const sa = a.stats.submittedBy || 0;
                const sb = b.stats.submittedBy || 0;
                return sortOrder === "asc" ? sa - sb : sb - sa;
              }

              // default: difficulty
              const diffA = a.stats.difficulty || 0;
              const diffB = b.stats.difficulty || 0;
              return sortOrder === "asc" ? diffA - diffB : diffB - diffA;
            })
            .map((question) => {
              return <QuestionCard key={question.id} question={question} />;
            })}
        </div>
      </div>
    </div>
  );
}

type AnswerWithStats = ExamEnvironmentAnswer & {
  stats: {
    seenBy: number;
    submittedBy: number;
  };
};
type QuestionWithStats = Omit<
  ExamEnvironmentMultipleChoiceQuestion,
  "answers"
> & {
  context: ExamEnvironmentQuestionSet["context"];
  stats: {
    seenBy: number;
    submittedBy: number;
    timeSpent: number;
    percentageCorrect: number;
    difficulty: number;
  };
  answers: AnswerWithStats[];
  i: number;
};

function QuestionCard({ question }: { question: QuestionWithStats }) {
  return (
    <div className="bg-muted relative mb-4">
      <div className="rounded-xl shadow-md relative z-[1] border border-border bg-card">
        <div className="px-4 py-3">
          <div className="max-w-full overflow-x-auto">
            <h3 className="text-lg font-semibold max-w-full">
              Question {question.id}
            </h3>
            {!!question.context && (
              <>
                <h4 className="text-base font-semibold max-w-full">Context</h4>
                <div
                  className="text-sm"
                  dangerouslySetInnerHTML={{
                    __html: parseMarkdown(question.context),
                  }}
                />
              </>
            )}
            <h4 className="text-base font-semibold max-w-full">Text</h4>
            <div
              className="text-sm"
              dangerouslySetInnerHTML={{
                __html: parseMarkdown(question.text),
              }}
            />
          </div>
        </div>
        <div className="px-4 pb-3">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            <Tooltip content="Number of attempts that included this question">
              <TitleStat title={"Seen By"} stat={question.stats.seenBy} />
            </Tooltip>

            <Tooltip content="Number of attempts that submitted an answer to this question">
              <TitleStat
                title="Submitted By"
                stat={question.stats.submittedBy}
              />
            </Tooltip>

            <Tooltip content="Average time spent on this question from start to submission">
              <TitleStat
                title="Time Spent"
                stat={question.stats.timeSpent.toFixed(2) + "s"}
              />
            </Tooltip>

            <Tooltip content="Percentage of submitted answers that selected a correct option">
              <TitleStat
                title="Correct"
                stat={question.stats.percentageCorrect.toFixed(2) + "%"}
              />
            </Tooltip>

            <Tooltip content="Normalized Time Spent divided by Percent Correct - higher indicates more difficult questions">
              <TitleStat
                title="Difficulty"
                stat={question.stats.difficulty.toFixed(2)}
              />
            </Tooltip>
          </div>
        </div>
        <div className="px-4 pb-4">
          <div className="flex flex-col gap-3 w-full">
            {question.answers.map((answer) => (
              <div
                key={answer.id}
                className={`p-3 bg-background rounded-md ${
                  answer.isCorrect
                    ? "border-2 border-green-500"
                    : "border border-border"
                }`}
              >
                <div
                  className="text-sm text-muted-foreground"
                  dangerouslySetInnerHTML={{
                    __html: parseMarkdown(answer.text),
                  }}
                />
                <div className="text-right min-w-[120px]">
                  <p className="text-muted-foreground text-sm">
                    Seen by: {answer.stats.seenBy} attempts
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Selected by: {answer.stats.submittedBy} attempts
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
