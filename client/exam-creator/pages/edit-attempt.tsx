import { useContext, useEffect, useRef, useState, useMemo } from "react";
import { InfiniteData, useMutation, useQuery } from "@tanstack/react-query";
import { useParams, useNavigate, useSearch } from "@tanstack/react-router";
import {
  ExamEnvironmentExamModeration,
  ExamEnvironmentExamModerationStatus,
} from "@prisma/client";

import { UsersWebSocketActivityContext } from "../contexts/users-websocket";
import { AuthContext } from "../contexts/auth";
import {
  getAttemptById,
  getAttemptsByUserId,
  getEventsByAttemptId,
  getModerationByAttemptId,
  getModerations,
  getNumberOfAttemptsByUserId,
  patchModerationStatusByAttemptId,
} from "../utils/fetch";
import { Attempt, Event } from "../types";
import { prettyDate, secondsToHumanReadable } from "../utils/question";
import { moderationKeys } from "../hooks/queries";
import {
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  ReferenceArea,
  Line,
  XAxis,
  YAxis,
  Legend,
  Scatter,
  DefaultLegendContent,
  DefaultLegendContentProps,
  TooltipContentProps,
} from "recharts";
import { BracketLayer } from "../components/diff-brackets";
import {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";
import { UsersOnPageAvatars } from "../components/users-on-page-avatars";
import { Loader2 } from "lucide-react";
import { NavBar } from "@/components/nav-bar";

export function Edit() {
  const { id } = useParams({ from: "/exam-creator/attempts/$id" });
  const { user, logout } = useContext(AuthContext)!;

  const attemptQuery = useQuery({
    queryKey: ["attempt", id],
    enabled: !!user,
    queryFn: () => getAttemptById(id!),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const eventsQuery = useQuery({
    queryKey: ["events", id],
    enabled: !!user,
    queryFn: () => getEventsByAttemptId(id!),
    staleTime: 3_600_000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar
        appName="Exam Creator"
        appHref="/exam-creator"
        userName={user?.name}
        onLogout={logout}
      />
      {/* Floating widget: top right */}
      <UsersEditing />
      <div className="py-14 px-2 flex-1">
      <div className="flex items-center justify-center">
        {attemptQuery.isPending || eventsQuery.isPending ? (
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-foreground border-t-transparent" />
        ) : attemptQuery.isError || eventsQuery.isError ? (
          <p className="text-red-400 text-lg">
            Error loading exam:{" "}
            {attemptQuery.error?.message ?? eventsQuery.error?.message}
          </p>
        ) : (
          <EditAttempt attempt={attemptQuery.data} events={eventsQuery.data} />
        )}
      </div>
      </div>
    </div>
  );
}

function UsersEditing() {
  const { updateActivity } = useContext(UsersWebSocketActivityContext)!;

  useEffect(() => {
    updateActivity({
      page: new URL(window.location.href),
      lastActive: Date.now(),
    });
  }, []);

  return (
    <div className="fixed top-4 right-72 z-[100] rounded-xl shadow-lg px-2 py-2 flex items-center gap-4">
      <UsersOnPageAvatars path={window.location.pathname} />
    </div>
  );
}

function EditAttempt({
  attempt,
  events,
}: {
  attempt: Attempt;
  events: Event[];
}) {
  const { updateActivity } = useContext(UsersWebSocketActivityContext)!;
  const [isSubmissionDiffToggled, setIsSubmissionDiffToggled] = useState(false);
  const [isSubmissionTimeToggled, setIsSubmissionTimeToggled] = useState(false);
  const [isSubmissionTimelineToggled, setIsSubmissionTimelineToggled] =
    useState(false);
  const [isEventsToggled, setIsEventsToggled] = useState(true);
  const buttonBoxRef = useRef<HTMLDivElement | null>(null);
  const approveButtonRef = useRef<HTMLButtonElement | null>(null);
  const denyButtonRef = useRef<HTMLButtonElement | null>(null);
  const navigate = useNavigate();
  const { filter } = useSearch({ from: "/exam-creator/attempts/$id" });

  const moderationQuery = useQuery({
    queryKey: ["moderation", attempt.id],
    queryFn: () => getModerationByAttemptId(attempt.id),
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    updateActivity({
      page: new URL(window.location.href),
      lastActive: Date.now(),
    });
  }, [attempt]);

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // 'm' key focuses the button box (and approve button)
      if (event.key === "m" || event.key === "M") {
        event.preventDefault();
        buttonBoxRef.current?.focus();
        approveButtonRef.current?.focus();
      }
    };

    const handleButtonBoxKeyPress = (event: KeyboardEvent) => {
      // Only handle 'a' and 'd' when the button box has focus
      if (event.key === "a" || event.key === "A") {
        event.preventDefault();
        approveButtonRef.current?.click();
      } else if (event.key === "d" || event.key === "D") {
        event.preventDefault();
        denyButtonRef.current?.click();
      }
    };

    // Global listener for 'm' key
    window.addEventListener("keydown", handleKeyPress);

    // Listener on button box for 'a' and 'd' keys
    const buttonBox = buttonBoxRef.current;
    if (buttonBox) {
      buttonBox.addEventListener("keydown", handleButtonBoxKeyPress);
    }

    return () => {
      window.removeEventListener("keydown", handleKeyPress);
      if (buttonBox) {
        buttonBox.removeEventListener("keydown", handleButtonBoxKeyPress);
      }
    };
  }, [buttonBoxRef.current, approveButtonRef.current, denyButtonRef.current]);

  const patchModerationStatusByAttemptIdMutation = useMutation({
    mutationKey: ["patch-moderation-status"],
    mutationFn: (status: ExamEnvironmentExamModerationStatus) => {
      return patchModerationStatusByAttemptId({
        status,
        attemptId: attempt.id,
      });
    },
    retry: false,
    onSuccess: (_a, _b, _c, ctx) => {
      // Navigate to next attempt
      const queriesData = ctx.client.getQueriesData<
        InfiniteData<Awaited<ReturnType<typeof getModerations>>, unknown>
      >({ queryKey: moderationKeys.all });
      const moderationsData = queriesData?.[0]?.[1];
      if (moderationsData) {
        // Find the index of the current attempt
        const flatModerations = moderationsData.pages.flat();
        const currentIndex = flatModerations.findIndex(
          (m) => m.examAttemptId === attempt.id,
        );
        const nextAttemptId =
          flatModerations.at(currentIndex + 1)?.examAttemptId ?? null;
        if (nextAttemptId) {
          navigate({
            to: "/exam-creator/attempts/$id",
            params: { id: nextAttemptId },
            search: { filter },
          });
          return;
        }
      }

      navigate({ to: "/exam-creator/attempts", search: { filter } });
    },
    onError: (error: any) => {
      alert(`Error submitting moderation: ${error.message}`);
    },
  });

  const attemptStatsQuery = useQuery({
    queryKey: [
      "attempt-stats-calc",
      isSubmissionTimeToggled,
      isSubmissionTimelineToggled,
      attempt.id,
      events,
    ],
    queryFn: () => {
      let {
        questions,
        totalQuestions,
        answered,
        correct,
        timeToComplete,
        averageTimePerQuestion,
      } = getAttemptStats(attempt, {
        isSubmissionTimeToggled,
        isSubmissionTimelineToggled,
      });

      return {
        questions,
        totalQuestions,
        answered,
        correct,
        timeToComplete,
        averageTimePerQuestion,
      };
    },
  });

  const chartData = useMemo(() => {
    if (!attemptStatsQuery.data) return null;
    const { questions } = attemptStatsQuery.data;
    const attemptStartTime = attempt.startTime.getTime();

    const correctAnswers = questions.filter((q) => q.isCorrect);

    const incorrectAnswers = questions.filter(
      (q) => !q.isCorrect && !!q.submissionTime,
    );

    const questionIdToIndexMap = new Map<string, number>();
    questions.forEach((q) => {
      questionIdToIndexMap.set(q.id, q.idx);
    });

    const visitEvents = events
      .filter((e) => e.kind === "QUESTION_VISIT")
      .map((e) => {
        // @ts-expect-error Types are hard
        const idx = questionIdToIndexMap.get(e.meta?.question ?? "");
        if (idx === undefined) return null;

        return {
          idx,
          timeSinceStartInS: (e.timestamp.getTime() - attemptStartTime) / 1000,
          kind: "QUESTION_VISIT",
        };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);

    // BLUR -> FOCUS
    const focusGaps = [];
    // sort events by time to ensure correct pairing
    const sortedEvents = [...events].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );

    let lastBlurEvent: Event | null = null;

    for (const e of sortedEvents) {
      if (e.kind === "BLUR") {
        lastBlurEvent = e;
      } else if (e.kind === "FOCUS" && lastBlurEvent) {
        const blurTime =
          (lastBlurEvent.timestamp.getTime() - attemptStartTime) / 1000;
        const focusTime = (e.timestamp.getTime() - attemptStartTime) / 1000;

        // Map to the question active during the blur, if possible
        const questionId = lastBlurEvent.meta?.question || e.meta?.question;
        const idx = questionId
          ? // @ts-expect-error Types \_O_/
            questionIdToIndexMap.get(questionId)
          : undefined;

        if (idx !== undefined) {
          focusGaps.push({
            idx,
            blurTime,
            focusTime,
            timeSinceStartInS: blurTime,
          });
        }

        lastBlurEvent = null;
      }
    }

    const finalSubmissionTime = Math.max(
      ...questions.map((q) => q.submissionTime?.getTime() ?? 0),
      ...events.map((e) => e.timestamp.getTime()),
    );

    return {
      correctAnswers,
      incorrectAnswers,
      visitEvents,
      focusGaps,
      finalSubmissionTime,
    };
  }, [attemptStatsQuery.data, events, attempt]);

  if (
    attemptStatsQuery.isFetching ||
    attemptStatsQuery.isError ||
    !attemptStatsQuery.isSuccess ||
    !chartData
  ) {
    return <div className="animate-spin rounded-full h-10 w-10 border-2 border-foreground border-t-transparent" />;
  }

  const {
    questions,
    totalQuestions,
    answered,
    correct,
    timeToComplete,
    averageTimePerQuestion,
  } = attemptStatsQuery.data;

  const { correctAnswers, incorrectAnswers, visitEvents, focusGaps } =
    chartData;

  return (
    <>
      <div
        ref={buttonBoxRef}
        className="bg-card fixed top-3 right-4 z-[100] rounded-xl shadow-lg px-2 py-2 flex items-center gap-4 outline-none"
        tabIndex={0}
      >
        <button
          ref={approveButtonRef}
          className="bg-green-600 hover:bg-green-500 text-white px-4 font-bold text-2xl rounded-md py-1.5 disabled:opacity-50 flex items-center gap-1"
          disabled={patchModerationStatusByAttemptIdMutation.isPending}
          onClick={() => {
            patchModerationStatusByAttemptIdMutation.mutate("Approved");
          }}
        >
          {patchModerationStatusByAttemptIdMutation.isPending && (
            <Loader2 size={20} className="animate-spin" />
          )}
          Approve
        </button>
        <button
          ref={denyButtonRef}
          className="bg-red-600 hover:bg-red-500 text-white px-4 font-bold text-2xl rounded-md py-1.5 disabled:opacity-50 flex items-center gap-1"
          disabled={patchModerationStatusByAttemptIdMutation.isPending}
          onClick={() => {
            patchModerationStatusByAttemptIdMutation.mutate("Denied");
          }}
        >
          {patchModerationStatusByAttemptIdMutation.isPending && (
            <Loader2 size={20} className="animate-spin" />
          )}
          Deny
        </button>
      </div>
      <div className="flex flex-col gap-8 w-full max-w-7xl">
        <div className="rounded-xl shadow-lg p-4 mb-4 w-full">
          <div className="flex flex-row justify-between items-center">
            <h2 className="font-extrabold text-2xl mb-2">
              {attempt.config.name}
            </h2>
            <p className="text-cyan-400">{prettyDate(attempt.startTime)}</p>
          </div>
          <div className="flex flex-col mb-4">
            <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-2">
              <div className="flex items-center gap-2">
                <label htmlFor="submission-diff" className="text-sm text-muted-foreground">
                  Submission Diff
                </label>
                <button
                  id="submission-diff"
                  role="switch"
                  aria-checked={isSubmissionDiffToggled}
                  onClick={() => setIsSubmissionDiffToggled(!isSubmissionDiffToggled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    isSubmissionDiffToggled ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isSubmissionDiffToggled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="submission-time-sort" className="text-sm text-muted-foreground">
                  Sort by Submission Time
                </label>
                <button
                  id="submission-time-sort"
                  role="switch"
                  aria-checked={isSubmissionTimeToggled}
                  onClick={() => setIsSubmissionTimeToggled(!isSubmissionTimeToggled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    isSubmissionTimeToggled ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isSubmissionTimeToggled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="submission-timeline" className="text-sm text-muted-foreground">
                  Submission Frequency
                </label>
                <button
                  id="submission-timeline"
                  role="switch"
                  aria-checked={isSubmissionTimelineToggled}
                  onClick={() => setIsSubmissionTimelineToggled(!isSubmissionTimelineToggled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    isSubmissionTimelineToggled ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isSubmissionTimelineToggled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="event-switch" className="text-sm text-muted-foreground">
                  Events
                </label>
                <button
                  id="event-switch"
                  role="switch"
                  aria-checked={isEventsToggled}
                  onClick={() => setIsEventsToggled(!isEventsToggled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    isEventsToggled ? "bg-primary" : "bg-muted"
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isEventsToggled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </div>
            <div className="resize-y overflow-auto">
              <ResponsiveContainer width="100%" minHeight={450}>
                <ComposedChart
                  margin={{ top: 15, right: 20, bottom: 5, left: 0 }}
                >
                  <CartesianGrid opacity={0.2} />
                  {isEventsToggled &&
                    focusGaps.map((f, i) => {
                      const stroke = "red";
                      const opacity = 0.3;
                      const y1 = f.blurTime;
                      const y2 = f.focusTime;

                      return (
                        <ReferenceArea
                          key={`focus-gap-${i}`}
                          {...{ y1, y2, stroke, opacity }}
                          yAxisId={"left"}
                        />
                      );
                    })}

                  {isSubmissionTimelineToggled && (
                    <Line
                      data={questions.filter((q) => !!q.questionTimeDiff)}
                      yAxisId="right"
                      type="monotone"
                      dataKey={"questionTimeDiff"}
                      stroke="#ff7300"
                      strokeWidth={2}
                      dot={false}
                    />
                  )}

                  <XAxis
                    dataKey="idx"
                    type="number"
                    domain={["dataMin", "dataMax"]}
                    tickCount={totalQuestions}
                    allowDecimals={false}
                    label={{
                      value: "question number",
                      position: "insideBottom",
                      offset: 0,
                    }}
                  />
                  <YAxis
                    width={60}
                    dataKey={"timeSinceStartInS"}
                    tickCount={30}
                    yAxisId={"left"}
                    type="number"
                    label={{
                      value: "seconds since start",
                      position: "insideBottomLeft",
                      angle: -90,
                      offset: 10,
                    }}
                  />
                  <YAxis
                    width={40}
                    yAxisId={"right"}
                    orientation="right"
                    label={{
                      value: "diff [s]",
                      position: "insideTopRight",
                      angle: -90,
                      offset: 10,
                    }}
                  />

                  <Legend
                    verticalAlign="top"
                    height={36}
                    content={legendFill}
                  />

                  <Scatter
                    name="Correct"
                    data={correctAnswers}
                    dataKey="timeSinceStartInS"
                    fill="green"
                    yAxisId="left"
                  />

                  <Scatter
                    name="Incorrect"
                    data={incorrectAnswers}
                    dataKey="timeSinceStartInS"
                    fill="red"
                    yAxisId="left"
                  />

                  {isEventsToggled && (
                    <Scatter
                      name="Visit"
                      data={visitEvents}
                      dataKey="timeSinceStartInS"
                      fill="transparent"
                      stroke="purple"
                      shape="circle"
                      yAxisId="left"
                    />
                  )}

                  {isSubmissionDiffToggled &&
                    questions.map((entry, index) => {
                      if (index === 0) return null;
                      const prev = questions[index - 1];
                      if (!entry.timeSinceStartInS || !prev.timeSinceStartInS)
                        return null;

                      const peakValue = Math.max(
                        prev.timeSinceStartInS,
                        entry.timeSinceStartInS,
                      );

                      return (
                        <ReferenceArea
                          key={`bracket-${index}`}
                          x1={prev.idx}
                          x2={entry.idx}
                          y1={peakValue}
                          y2={peakValue}
                          strokeOpacity={0}
                          yAxisId={"left"}
                          fillOpacity={0}
                          label={
                            <BracketLayer
                              prevValue={prev.timeSinceStartInS}
                              currValue={entry.timeSinceStartInS}
                            />
                          }
                        />
                      );
                    })}
                  <RechartsTooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    content={TooltipContent}
                    shared={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-muted p-2 rounded-md border-l-4 border-border">
                <p className="text-sm text-foreground mb-1">Total Questions</p>
                <p className="text-2xl font-bold text-muted-foreground">{totalQuestions}</p>
              </div>
              <div className="bg-muted p-2 rounded-md border-l-4 border-border">
                <p className="text-sm text-foreground mb-1">Answered</p>
                <p className="text-2xl font-bold text-muted-foreground">
                  {answered}
                  <span className="text-sm text-muted-foreground ml-2">
                    {((answered / totalQuestions) * 100).toFixed(1)}%
                  </span>
                </p>
              </div>
              <div className="bg-muted p-2 rounded-md border-l-4 border-green-400">
                <p className="text-sm text-foreground mb-1">Correct Answers</p>
                <p className="text-2xl font-bold text-muted-foreground">
                  {correct}
                  <span className="text-sm text-muted-foreground ml-2">
                    (
                    {totalQuestions > 0
                      ? ((correct / totalQuestions) * 100).toFixed(1)
                      : 0}
                    %)
                  </span>
                </p>
              </div>
              <div className="bg-muted p-2 rounded-md border-l-4 border-green-400">
                <p className="text-sm text-foreground mb-1">Accuracy</p>
                <p className="text-2xl font-bold text-muted-foreground">
                  {answered > 0 ? ((correct / answered) * 100).toFixed(1) : 0}%
                </p>
              </div>
              <div className="bg-muted p-2 rounded-md border-l-4 border-teal-400">
                <p className="text-sm text-foreground mb-1">Total Time</p>
                <p className="text-2xl font-bold text-muted-foreground">
                  {secondsToHumanReadable(timeToComplete)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {timeToComplete.toFixed(0)}s
                </p>
              </div>
              <div className="bg-muted p-2 rounded-md border-l-4 border-teal-400">
                <p className="text-sm text-foreground mb-1">Avg Time / Question</p>
                <p className="text-2xl font-bold text-muted-foreground">
                  {averageTimePerQuestion}s
                </p>
              </div>
              <div className="bg-muted p-2 rounded-md border-l-4 border-purple-400">
                <p className="text-sm text-foreground mb-1">Events</p>
                <p className="text-2xl font-bold text-muted-foreground">
                  {events.length}
                </p>
              </div>
              <div className="bg-muted p-2 rounded-md border-l-4 border-blue-400">
                <p className="text-sm text-foreground mb-1">Total Unfocussed Time</p>
                <p className="text-2xl font-bold text-muted-foreground">
                  {focusGaps
                    .reduce(
                      (acc, curr) => acc + (curr.focusTime - curr.blurTime),
                      0,
                    )
                    .toFixed(2)}
                  s
                </p>
              </div>
              <div className="bg-muted p-2 rounded-md border-l-4 border-blue-400">
                <p className="text-sm text-foreground mb-1">Unfocussed Time Before Final Submission</p>
                <p className="text-2xl font-bold text-muted-foreground">
                  {focusGaps
                    .reduce((acc, curr) => {
                      if (
                        curr.blurTime > timeToComplete ||
                        curr.focusTime > timeToComplete
                      ) {
                        return acc;
                      }
                      return acc + (curr.focusTime - curr.blurTime);
                    }, 0)
                    .toFixed(2)}
                  s
                </p>
              </div>
            </div>
            {moderationQuery.data?.feedback && (
              <p className="text-foreground py-3">
                <b>Feedback</b>: {moderationQuery.data?.feedback}
              </p>
            )}
            <AllUserAttemptsContainer
              attempt={attempt}
              options={{ isSubmissionTimeToggled, isSubmissionTimelineToggled }}
            />
          </div>
        </div>
      </div>
    </>
  );
}

function TooltipContent({
  active,
  payload,
}: TooltipContentProps<ValueType, NameType>) {
  const showTooltip = active && payload && payload.length;
  if (!showTooltip) {
    return null;
  }
  const data = payload[0].payload;
  const label =
    typeof data.isCorrect === "boolean"
      ? data.isCorrect
        ? "Correct"
        : "Incorrect"
      : data.kind;
  return (
    <div className="flex flex-col text-muted-foreground bg-black/30 border border-blue-500/30 p-2">
      <p>Label: {label}</p>
      <p>Question: {data.idx}</p>
      <p>Time [s]: {data.timeSinceStartInS}</p>
    </div>
  );
}

function legendFill({ payload, ref, ...rest }: DefaultLegendContentProps) {
  const payloadWithFill = payload?.map((p) => {
    const color =
      // @ts-ignore
      p.color === "transparent" ? (p.payload?.stroke ?? "white") : p.color;
    return {
      ...p,
      color,
    };
  });
  return <DefaultLegendContent payload={payloadWithFill} {...rest} />;
}

function AllUserAttemptsContainer({
  attempt,
  options,
}: {
  attempt: Attempt;
  options: AttemptOptions;
}) {
  const attemptsMutation = useMutation({
    mutationKey: ["user-attempts", attempt.userId],
    mutationFn: async (userId: string) => {
      const attempts = await getAttemptsByUserId(userId);
      const moderations = await Promise.all(
        attempts.map((a) => getModerationByAttemptId(a.id).catch(() => null)),
      );
      return { attempts, moderations };
    },
    retry: false,
  });
  const numberOfAttemptsQuery = useQuery({
    queryKey: ["user-number-of-attempts", attempt.userId],
    queryFn: () => getNumberOfAttemptsByUserId(attempt.userId),
    retry: false,
    refetchOnWindowFocus: false,
  });

  return (
    <div className="flex items-center justify-center mt-2">
      {!attemptsMutation.data ? (
        <button
          className="bg-teal-600 hover:bg-teal-500 text-white px-6 py-2.5 rounded-md font-medium text-lg disabled:opacity-50 flex items-center gap-1"
          onClick={() => attemptsMutation.mutate(attempt.userId)}
          disabled={attemptsMutation.isPending}
        >
          {attemptsMutation.isPending && (
            <Loader2 size={18} className="animate-spin" />
          )}
          Fetch All User Attempts (
          {numberOfAttemptsQuery.isFetching ? (
            <Loader2 size={14} className="animate-spin inline" />
          ) : numberOfAttemptsQuery.isError ? (
            "?"
          ) : (
            numberOfAttemptsQuery.data
          )}
          )
        </button>
      ) : (
        <AllUserAttempts
          attempts={attemptsMutation.data.attempts}
          moderations={attemptsMutation.data.moderations}
          currentAttemptId={attempt.id}
          options={options}
        />
      )}
    </div>
  );
}

function AllUserAttempts({
  attempts,
  moderations,
  currentAttemptId,
  options,
}: {
  attempts: Attempt[];
  moderations: (ExamEnvironmentExamModeration | null | undefined)[];
  currentAttemptId: string;
  options: AttemptOptions;
}) {
  if (attempts.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold mb-4">
        All User Attempts for This Exam
      </h3>
      <div className="overflow-x-auto">
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: "8px" }}>Date Taken</th>
              <th style={{ textAlign: "left", padding: "8px" }}>Exam</th>
              <th style={{ textAlign: "left", padding: "8px" }}>Answers</th>
              <th style={{ textAlign: "left", padding: "8px" }}>
                Average Time
              </th>
              <th style={{ textAlign: "left", padding: "8px" }}>Total Time</th>
              <th style={{ textAlign: "left", padding: "8px" }}>Score</th>
              <th style={{ textAlign: "left", padding: "8px" }}>Status</th>
              <th style={{ textAlign: "left", padding: "8px" }}>Feedback</th>
            </tr>
          </thead>
          <tbody>
            {attempts.map((attempt, index) => {
              const {
                correct,
                totalQuestions,
                averageTimePerQuestion,
                timeToComplete,
                answered,
              } = getAttemptStats(attempt, options);
              const moderation = moderations[index];
              const isCurrent = attempt.id === currentAttemptId;
              return (
                <tr
                  key={attempt.id}
                  style={{
                    borderBottom: "1px solid #ccc",
                    background: isCurrent ? "rgba(0,128,128,0.15)" : undefined,
                  }}
                >
                  <td style={{ padding: "8px" }}>
                    {prettyDate(attempt.startTime)}
                  </td>
                  <td style={{ padding: "8px" }}>{attempt.config.name}</td>
                  <td style={{ padding: "8px" }}>
                    {correct}/{answered}
                  </td>
                  <td style={{ padding: "8px" }}>{averageTimePerQuestion}s</td>
                  <td style={{ padding: "8px" }}>
                    {timeToComplete.toFixed(0)}s
                  </td>
                  <td style={{ padding: "8px" }}>
                    {totalQuestions > 0
                      ? ((correct / totalQuestions) * 100).toFixed(1)
                      : 0}
                    %
                  </td>
                  <td style={{ padding: "8px" }}>
                    {moderation ? (
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          moderation.status === "Pending"
                            ? "bg-blue-500/20 text-blue-400"
                            : moderation.status === "Approved"
                              ? "bg-green-500/20 text-green-400"
                              : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        {moderation.status}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">&mdash;</span>
                    )}
                  </td>
                  <td style={{ padding: "8px" }}>
                    {moderation?.feedback ? (
                      <p>{moderation.feedback}</p>
                    ) : (
                      <span className="text-muted-foreground">&mdash;</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type QuestionData = {
  isCorrect: boolean;
  timeSinceStartInS: number | null;
  idx: number;
  questionTimeDiff?: number;
} & Attempt["questionSets"][number]["questions"][number];
type AttemptOptions = {
  isSubmissionTimeToggled: boolean;
  isSubmissionTimelineToggled: boolean;
};

function getAttemptStats(attempt: Attempt, options: AttemptOptions) {
  const startTimeInMS = attempt.startTime.getTime();

  const flattened = attempt.questionSets.flatMap((qs) => qs.questions);
  const totalQuestions = flattened.filter((q) => !!q.generated.length).length;

  let correct = 0;
  let questions: QuestionData[] = [];
  for (const question of flattened) {
    const submissionTime = question.submissionTime;
    // if generation has 0 anwers, then question is not in generation, and should be skipped
    const inGeneration = !!question.generated.length;
    if (!inGeneration) {
      continue;
    }
    const allCorrectAnswerIds = question.answers
      .filter((a) => a.isCorrect)
      .map((a) => a.id);
    const allShownCorrectAnswers = question.generated.filter((ga) =>
      allCorrectAnswerIds.includes(ga),
    );
    // Every shown correct answer is selected
    const isCorrect = allShownCorrectAnswers.every((a) =>
      question.selected.includes(a),
    );
    if (isCorrect) {
      correct++;
    }

    const timeSinceStartInS = submissionTime
      ? (submissionTime.getTime() - startTimeInMS) / 1000
      : null;

    const q = {
      ...question,
      idx: questions.length,
      timeSinceStartInS,
      isCorrect,
    };
    questions.push(q);
  }

  if (options.isSubmissionTimeToggled) {
    questions.sort((a, b) => {
      return (a.timeSinceStartInS ?? 0) - (b.timeSinceStartInS ?? 0);
    });
  }

  if (options.isSubmissionTimelineToggled) {
    questions = questions.map((t, i) => {
      if (!t.timeSinceStartInS) return t;
      if (i === 0) return { ...t, questionTimeDiff: t.timeSinceStartInS };

      const prev = questions[i - 1];

      if (!prev.timeSinceStartInS) return t;

      return {
        ...t,
        questionTimeDiff: t.timeSinceStartInS - prev.timeSinceStartInS,
      };
    });
  }

  const lastSubmission = Math.max(
    ...flattened.map((f) => {
      return f.submissionTime?.getTime() ?? 0;
    }),
  );
  const timeToComplete = (lastSubmission - startTimeInMS) / 1000;

  const answered = questions.length;
  const averageTimePerQuestion =
    answered > 0 ? (timeToComplete / answered).toFixed(2) : "0";

  return {
    questions,
    totalQuestions,
    answered,
    correct,
    timeToComplete,
    averageTimePerQuestion,
  };
}
