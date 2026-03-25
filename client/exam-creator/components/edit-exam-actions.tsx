import { useState } from "react";
import { CodeXml, Save, Loader2 } from "lucide-react";
import {
  postValidateConfigByExamId,
  putExamById,
  putExamEnvironmentChallenges,
} from "../utils/fetch";
import {
  ExamCreatorExam,
  ExamEnvironmentChallenge,
  ExamEnvironmentConfig,
  ExamEnvironmentQuestionSet,
} from "@prisma/client";
import { useMutation } from "@tanstack/react-query";
import { GenerateModal } from "./generate-modal";
import { deserializeToPrisma } from "../utils/serde";
import { queryClient } from "@/router";
import { toaster } from "./toaster";

interface EditExamActionsProps {
  exam: ExamCreatorExam;
  config: ExamEnvironmentConfig;
  questionSets: ExamEnvironmentQuestionSet[];
  examEnvironmentChallenges: Omit<ExamEnvironmentChallenge, "id">[];
}

export function EditExamActions({
  exam,
  config,
  questionSets,
  examEnvironmentChallenges,
}: EditExamActionsProps) {
  const [generateIsOpen, setGenerateIsOpen] = useState(false);

  const invalidConfigMutation = useMutation({
    mutationFn: async (examId: string) => {
      await postValidateConfigByExamId(examId);
    },
    onError(error) {
      toaster.create({
        title: "Invalid Exam Configuration",
        description: error.message,
        type: "loading",
        closable: true,
      });
    },
  });

  const handleDatabaseSave = useMutation({
    mutationFn: ({
      exam,
      examEnvironmentChallenges,
      config,
      questionSets,
    }: {
      exam: ExamCreatorExam;
      examEnvironmentChallenges: Omit<ExamEnvironmentChallenge, "id">[];
      config: ExamEnvironmentConfig;
      questionSets: ExamEnvironmentQuestionSet[];
    }) => {
      return Promise.all([
        putExamById({ ...exam, config, questionSets }),
        putExamEnvironmentChallenges(exam.id, examEnvironmentChallenges),
      ]);
    },
    onSuccess([examData, examEnvironmentChallengesData]) {
      queryClient.setQueryData(
        ["exam", exam.id],
        deserializeToPrisma(examData),
      );
      queryClient.setQueryData(
        ["exam-challenges", exam.id],
        deserializeToPrisma(examEnvironmentChallengesData),
      );
      invalidConfigMutation.mutate(exam.id);
      toaster.create({
        title: "Exam Saved",
        description: "Your exam has been saved to the temporary database.",
        type: "success",
        duration: 1000,
        closable: true,
      });
    },
    onError(error: Error) {
      console.error(error);
      toaster.create({
        title: "Error Saving Exam",
        description: error.message || "An error occurred saving exam.",
        type: "error",
        duration: 5000,
        closable: true,
      });
    },
    retry: false,
  });

  return (
    <div className="fixed top-3 right-4 z-[100] bg-card rounded-xl shadow-lg px-2 py-2 flex flex-col items-center gap-4">
      <button
        className="bg-teal-600 hover:bg-teal-500 text-white px-4 py-1.5 font-bold rounded-md flex items-center gap-1 disabled:opacity-50"
        disabled={handleDatabaseSave.isPending}
        onClick={() =>
          handleDatabaseSave.mutate({
            exam,
            config,
            questionSets,
            examEnvironmentChallenges,
          })
        }
      >
        {handleDatabaseSave.isPending ? (
          <Loader2 size={18} className="animate-spin" />
        ) : (
          <Save size={18} />
        )}
        Save to Database
      </button>
      <button
        className="bg-teal-600 hover:bg-teal-500 text-white px-4 py-1.5 font-bold rounded-md flex items-center gap-1"
        onClick={() => setGenerateIsOpen(true)}
      >
        <CodeXml size={18} />
        Generate Exams
      </button>
      <GenerateModal
        open={generateIsOpen}
        onClose={() => setGenerateIsOpen(false)}
        examId={exam.id}
      />
    </div>
  );
}
