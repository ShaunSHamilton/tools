import { useState, useContext, useReducer, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import type {
  ExamCreatorExam,
  ExamEnvironmentChallenge,
  ExamEnvironmentConfig,
} from "@prisma/client";

import { QuestionForm } from "../components/question-form";
import {
  getExamById,
  getExamChallengeByExamId,
  getGenerations,
} from "../utils/fetch";
import { TagConfigForm } from "../components/tag-config-form";
import { QuestionSearch } from "../components/question-search";
import { EditExamActions } from "../components/edit-exam-actions";
import { QuestionTypeConfigForm } from "../components/question-type-config-form";
import { UsersWebSocketActivityContext } from "../contexts/users-websocket";
import { AuthContext } from "../contexts/auth";
import { EditExamGenerationVariability } from "../components/edit-exam-generation-variability";
import { EditExamConfig } from "../components/edit-exam-config";
import { ConfigView } from "../components/config-view";
import { UsersOnPageAvatars } from "../components/users-on-page-avatars";
import { ExamLayout } from "../components/ExamLayout";

export function Edit() {
  const { id } = useParams({ from: "/exam-creator/exams/$id" });
  const { user } = useContext(AuthContext)!;

  const examQuery = useQuery({
    queryKey: ["exam", id],
    enabled: !!user,
    queryFn: () => getExamById(id!),
    retry: false,
    refetchOnWindowFocus: false,
  });

  return (
    <ExamLayout>
      {/* Floating widget: top right */}
      <UsersEditing />
      <div className="py-8 px-2 flex-1">
      <div className="flex items-center justify-center">
        {examQuery.isPending ? (
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
        ) : examQuery.isError ? (
          <p className="text-red-400 text-lg">
            Error loading exam: {examQuery.error.message}
          </p>
        ) : (
          <EditExam exam={examQuery.data} />
        )}
      </div>
      </div>
    </ExamLayout>
  );
}

function UsersEditing() {
  return (
    <div className="fixed top-4 right-64 z-[100] rounded-xl shadow-lg px-2 py-2 flex items-center gap-4">
      <UsersOnPageAvatars path={window.location.pathname} />
    </div>
  );
}

function examReducer(state: ExamCreatorExam, action: Partial<ExamCreatorExam>) {
  const newState = { ...state, ...action };
  return newState;
}

function configReducer(
  state: ExamEnvironmentConfig,
  action: Partial<ExamEnvironmentConfig>,
) {
  const newState = { ...state, ...action };
  return newState;
}

interface EditExamProps {
  exam: ExamCreatorExam;
}

function EditExam({ exam: examData }: EditExamProps) {
  const { updateActivity } = useContext(UsersWebSocketActivityContext)!;
  const [exam, setExam] = useReducer(examReducer, examData);
  const [config, setConfig] = useReducer(configReducer, exam.config);
  const [questionSets, setQuestionSets] = useState(exam.questionSets);

  const [searchIds, setSearchIds] = useState<string[]>([]);

  const examEnvironmentChallengesQuery = useQuery({
    queryKey: ["exam-challenges", exam.id],
    queryFn: () => getExamChallengeByExamId(exam.id),
    retry: false,
    refetchOnWindowFocus: false,
  });

  const [examEnvironmentChallenges, setExamEnvironmentChallenges] = useState<
    Omit<ExamEnvironmentChallenge, "id">[]
  >(examEnvironmentChallengesQuery.data || []);

  const generatedExamsStagingQuery = useQuery({
    queryKey: ["generated-exams", exam.id, "Staging"],
    queryFn: () =>
      getGenerations({
        examId: exam.id,
        databaseEnvironment: "Staging",
      }),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const generatedExamsProductionQuery = useQuery({
    queryKey: ["generated-exams", exam.id, "Production"],
    queryFn: () =>
      getGenerations({
        examId: exam.id,
        databaseEnvironment: "Production",
      }),
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

  useEffect(() => {
    if (examEnvironmentChallengesQuery.data) {
      setExamEnvironmentChallenges(examEnvironmentChallengesQuery.data);
    }
  }, [examEnvironmentChallengesQuery.data]);

  // { [type]: { numberOfSet: number, numberOfQuestions: number } }
  const questionsBySet = questionSets.reduce(
    (acc, qs) => {
      if (qs.type in acc) {
        acc[qs.type].numberOfSet += 1;
        acc[qs.type].numberOfQuestions += qs.questions.length;
      } else {
        acc[qs.type] = {
          numberOfSet: 1,
          numberOfQuestions: qs.questions.length,
        };
      }
      return acc;
    },
    {} as { [key: string]: { numberOfSet: number; numberOfQuestions: number } },
  );

  return (
    <>
      <EditExamActions
        {...{
          exam,
          config,
          questionSets,
          examEnvironmentChallenges,
        }}
      />
      <div className="flex flex-col gap-8 w-full max-w-7xl">
        <div className="bg-card rounded-xl shadow-lg p-8 mb-4 w-full">
          <div className="flex flex-row">
            <h2 className="font-extrabold text-2xl mb-2">Edit Exam</h2>
            <div className="ml-2">
              <QuestionSearch
                exam={exam}
                setSearchIds={setSearchIds}
                searchIds={searchIds}
              />
            </div>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            <EditExamConfig
              {...{
                exam,
                setExam,
                config,
                setConfig,
                examEnvironmentChallengesQuery,
                examEnvironmentChallenges,
                setExamEnvironmentChallenges,
              }}
            />
            <hr className="my-4 border-border" />
            <h3 className="text-lg font-semibold mb-2" id="current-configs-main">
              Configure Question Distribution
            </h3>

            <p className="mb-2">
              This section allows you to configure how many questions you want
              to add to the exam for a specific topic.
            </p>

            <div className="mb-4">
              <div className="overflow-x-auto rounded-md p-2">
                <table className="w-full text-sm border border-border">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-2 text-teal-400 font-semibold">
                        Set Type
                      </th>
                      <th className="text-left p-2 font-semibold">Number of Set</th>
                      <th className="text-left p-2 font-semibold">
                        Number of Questions (total)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(questionsBySet).map(([type, data]) => (
                      <tr key={type} className="border-b border-border">
                        <td className="p-2 font-bold">{type}</td>
                        <td className="p-2">{data.numberOfSet}</td>
                        <td className="p-2">{data.numberOfQuestions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <EditExamGenerationVariability
              examId={exam.id}
              generatedExamsStagingData={generatedExamsStagingQuery.data}
              generatedExamsProductionData={generatedExamsProductionQuery.data}
            />
            <hr className="my-4 border-border" />
            <div className="flex justify-evenly items-start">
              <TagConfigForm
                questionSets={questionSets}
                setConfig={setConfig}
                config={config}
              />
              <QuestionTypeConfigForm
                questionSets={questionSets}
                setConfig={setConfig}
                config={config}
              />
            </div>
            <h4 className="text-base font-semibold mt-6 mb-2">
              Current Configs
            </h4>
            <p className="mb-2">
              These are the current configs which the algorithm will select
              random questions from:
            </p>
            <ConfigView {...{ config, setConfig }} />

            <hr className="my-4 border-border" />
            <h3 className="text-lg font-semibold mt-8 mb-2" id="exam-questions">
              Exam Questions
            </h3>
            <p className="mb-2">
              You can create new questions here. Your questions are not saved to
              the database until you click the "Save to Database" button.
            </p>
            <div className="rounded-lg p-4 mt-2">
              <QuestionForm
                searchIds={searchIds}
                questionSets={questionSets}
                setQuestionSets={setQuestionSets}
                generatedExamsStagingQuery={generatedExamsStagingQuery}
                generatedExamsProductionQuery={generatedExamsProductionQuery}
              />
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
