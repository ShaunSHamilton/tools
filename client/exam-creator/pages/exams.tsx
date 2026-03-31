import { useContext, useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  Plus,
  Download,
  X,
  ChevronDownIcon,
  CodeXml,
  AppWindow,
  Trash2,
  Loader2,
} from "lucide-react";

import { ExamCard } from "../components/exam-card";
import {
  getExamById,
  getExams,
  postExam,
  putExamByIdToProduction,
  putExamByIdToStaging,
} from "../utils/fetch";
import { UsersWebSocketActivityContext } from "../contexts/users-websocket";
import { AuthContext } from "../contexts/auth";
import { serializeFromPrisma } from "../utils/serde";
import {
  SeedProductionModal,
  SeedStagingModal,
} from "../components/seed-modal";
import { toaster } from "../components/toaster";
import { Header } from "../components/ui/header";
import { NavBar } from "@/components/nav-bar";

export function Exams() {
  const { user, logout } = useContext(AuthContext)!;
  const { updateActivity } = useContext(UsersWebSocketActivityContext)!;
  const navigate = useNavigate();

  const [selectedExams, setSelectedExams] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);

  const [stagingIsOpen, setStagingIsOpen] = useState(false);
  const [productionIsOpen, setProductionIsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const examsQuery = useQuery({
    queryKey: ["exams"],
    enabled: !!user,
    queryFn: () => getExams(),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const createExamMutation = useMutation({
    mutationFn: () => postExam(),
    onSuccess(data, _variables, _context) {
      navigate({
        to: "/exam-creator/exams/$id",
        params: { id: data.id },
      });
    },
  });
  const examByIdMutation = useMutation({
    mutationFn: (examIds: string[]) => {
      const promises = examIds.map((id) => getExamById(id));
      return Promise.all(promises);
    },
    onSuccess(data, _variables, _context) {
      const serialized = serializeFromPrisma(data, -1);
      const dataStr = JSON.stringify(serialized, null, 2);
      const dataBlob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(dataBlob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `exams-export-${
        new Date().toISOString().split("T")[0]
      }.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      handleDeselectAll();
    },
  });

  const seedExamToStagingMutation = useMutation({
    mutationFn: (examIds: string[]) => {
      const promises = examIds.map((id) => putExamByIdToStaging(id));
      return Promise.all(promises);
    },
    onSuccess(_data, _variables, _context) {
      setStagingIsOpen(false);
      handleDeselectAll();
      examsQuery.refetch();
      toaster.create({
        title: "Exams seeded to staging",
        description: "The selected exams have been seeded to staging.",
        type: "success",
        duration: 5000,
        closable: true,
      });
    },
  });

  const seedExamToProductionMutation = useMutation({
    mutationFn: (examIds: string[]) => {
      const promises = examIds.map((id) => putExamByIdToProduction(id));
      return Promise.all(promises);
    },
    onSuccess(_data, _variables, _context) {
      setProductionIsOpen(false);
      handleDeselectAll();
      examsQuery.refetch();
      toaster.create({
        title: "Exams seeded to production",
        description: "The selected exams have been seeded to production.",
        type: "success",
        duration: 5000,
        closable: true,
      });
    },
  });

  function handleExamSelection(examId: string, selected: boolean) {
    setSelectedExams((prev) => {
      const newSelection = new Set(prev);
      if (selected) {
        newSelection.add(examId);
      } else {
        newSelection.delete(examId);
      }
      return newSelection;
    });
  }

  function handleSelectAll() {
    if (examsQuery.data) {
      setSelectedExams(new Set(examsQuery.data.map(({ exam }) => exam.id)));
    }
  }

  function handleDeselectAll() {
    setSelectedExams(new Set());
  }

  function handleExportSelected() {
    if (!examsQuery.data || selectedExams.size === 0) return;

    const examIds = [...selectedExams];

    examByIdMutation.mutate(examIds);
  }

  function handleSeedSelectedToStaging() {
    if (!examsQuery.data || selectedExams.size === 0) return;

    const examIds = [...selectedExams];

    seedExamToStagingMutation.mutate(examIds);
  }

  function handleSeedSelectedToProduction() {
    if (!examsQuery.data || selectedExams.size === 0) return;

    const examIds = [...selectedExams];

    seedExamToProductionMutation.mutate(examIds);
  }

  function toggleSelectionMode() {
    setSelectionMode(!selectionMode);
    setSelectedExams(new Set());
  }

  useEffect(() => {
    updateActivity({
      page: new URL(window.location.href),
      lastActive: Date.now(),
    });
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <NavBar
        appName="Exam Creator"
        color="teal"
        appHref="/exam-creator"
        userName={user?.name}
        onLogout={logout}
      />
      <div className="py-12 px-4 flex-1">
      <div className="flex items-center justify-center">
        <div className="flex flex-col gap-8 w-full max-w-7xl">
          <Header
            title="Exam Creator"
            description="Create exams for the Exam Environment"
          >
            <div className="flex items-center gap-4 ml-8">
              <button
                className={`border px-6 font-bold rounded-md py-1.5 ${
                  selectionMode
                    ? "border-red-500 text-red-500 hover:bg-red-500/10"
                    : "border-blue-500 text-blue-500 hover:bg-blue-500/10"
                }`}
                onClick={toggleSelectionMode}
              >
                {selectionMode ? <X size={18} className="inline mr-1" /> : null}
                {selectionMode ? "Cancel Selection" : "Select Exams"}
              </button>
              <button
                className="bg-teal-600 hover:bg-teal-500 text-white px-6 font-bold shadow-md rounded-md py-1.5 flex items-center gap-1 disabled:opacity-50"
                onClick={() => {
                  createExamMutation.mutate();
                }}
                disabled={createExamMutation.isPending}
              >
                {createExamMutation.isPending ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Plus size={18} />
                )}
                {createExamMutation.isPending ? "Creating Exam" : "New Exam"}
              </button>
            </div>
            {createExamMutation.isError && (
              <div
                role="alert"
                className="absolute top-0 left-0 bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-md"
              >
                <p className="font-semibold">Unable to create exam!</p>
                <p>{createExamMutation.error.message}</p>
              </div>
            )}
          </Header>

          {selectionMode && (
            <div className="flex justify-between items-center bg-muted rounded-xl p-6 shadow-lg mb-2">
              <div className="flex items-center gap-4">
                <p className="text-foreground text-base">
                  {selectedExams.size} exam{selectedExams.size !== 1 ? "s" : ""}{" "}
                  selected
                </p>
                <button
                  className="border border-teal-500 text-teal-500 hover:bg-teal-500/10 rounded-md px-3 py-1 text-sm"
                  onClick={handleSelectAll}
                  disabled={!examsQuery.data}
                >
                  Select All
                </button>
                <button
                  className="border border-red-500 text-red-500 hover:bg-red-500/10 rounded-md px-3 py-1 text-sm disabled:opacity-50"
                  onClick={handleDeselectAll}
                  disabled={selectedExams.size === 0}
                >
                  Deselect All
                </button>
              </div>
              <div className="relative">
                <button
                  className="bg-background text-foreground border border-border rounded-md px-4 py-1.5 flex items-center gap-1"
                  onClick={() => setMenuOpen(!menuOpen)}
                >
                  Actions
                  <ChevronDownIcon size={16} />
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-full mt-1 z-50 bg-background border border-border rounded-md shadow-lg min-w-[200px]">
                    <button
                      className="w-full text-left px-4 py-2 hover:bg-muted flex items-center gap-2 font-bold disabled:opacity-50"
                      disabled={
                        selectedExams.size === 0 ||
                        examByIdMutation.isPending
                      }
                      onClick={() => {
                        handleExportSelected();
                        setMenuOpen(false);
                      }}
                    >
                      {examByIdMutation.isPending ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <Download size={18} />
                      )}
                      {examByIdMutation.isPending ? "Prepping Export" : "Export Selected"}
                    </button>
                    <button
                      className="w-full text-left px-4 py-2 hover:bg-muted flex items-center gap-2 font-bold disabled:opacity-50"
                      disabled={
                        selectedExams.size === 0 ||
                        seedExamToStagingMutation.isPending
                      }
                      onClick={() => {
                        setStagingIsOpen(true);
                        setMenuOpen(false);
                      }}
                    >
                      {seedExamToStagingMutation.isPending ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <CodeXml size={18} />
                      )}
                      {seedExamToStagingMutation.isPending ? "Seed in progress" : "Seed to Staging"}
                    </button>
                    <button
                      className="w-full text-left px-4 py-2 hover:bg-muted flex items-center gap-2 font-bold disabled:opacity-50"
                      disabled={
                        selectedExams.size === 0 ||
                        seedExamToProductionMutation.isPending
                      }
                      onClick={() => {
                        setProductionIsOpen(true);
                        setMenuOpen(false);
                      }}
                    >
                      {seedExamToProductionMutation.isPending ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <AppWindow size={18} />
                      )}
                      {seedExamToProductionMutation.isPending ? "Seed in progress" : "Seed to Production"}
                    </button>
                    {/* TODO: Probably never going to create such functionality */}
                    <button
                      className="w-full text-left px-4 py-2 hover:bg-muted flex items-center gap-2 font-bold opacity-50 cursor-not-allowed"
                      disabled={true}
                    >
                      <Trash2 size={18} />
                      Delete (TBD)
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          <div>
            {examsQuery.isPending ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent" />
              </div>
            ) : examsQuery.isError ? (
              <div className="flex items-center justify-center">
                <p className="text-red-400 text-lg">
                  {examsQuery.error.message}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-8">
                {examsQuery.data.map(({ exam, databaseEnvironments }) => (
                  <ExamCard
                    key={exam.id}
                    exam={exam}
                    databaseEnvironments={databaseEnvironments}
                    isSelected={selectedExams.has(exam.id)}
                    onSelectionChange={handleExamSelection}
                    selectionMode={selectionMode}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      <SeedStagingModal
        open={stagingIsOpen}
        onClose={() => setStagingIsOpen(false)}
        handleSeedSelectedToStaging={handleSeedSelectedToStaging}
        seedExamToStagingMutation={seedExamToStagingMutation}
      />
      <SeedProductionModal
        open={productionIsOpen}
        onClose={() => setProductionIsOpen(false)}
        handleSeedSelectedToProduction={handleSeedSelectedToProduction}
        seedExamToProductionMutation={seedExamToProductionMutation}
      />
      </div>
    </div>
  );
}
