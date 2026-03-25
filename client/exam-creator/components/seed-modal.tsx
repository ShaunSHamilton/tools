import { UseMutationResult } from "@tanstack/react-query";
import { useState } from "react";
import { Loader2 } from "lucide-react";

interface SeedStagingModalProps {
  open: boolean;
  onClose: () => void;
  handleSeedSelectedToStaging: () => void;
  seedExamToStagingMutation: UseMutationResult<
    Response[],
    Error,
    string[],
    unknown
  >;
}

export function SeedStagingModal({
  open,
  onClose,
  handleSeedSelectedToStaging,
  seedExamToStagingMutation,
}: SeedStagingModalProps) {
  const [val, setVal] = useState("");

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setVal(e.target.value);
  }

  function handleClose() {
    setVal("");
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60" onClick={handleClose} />
      <div className="relative z-50 w-full max-w-lg bg-gray-700 text-white rounded-lg shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-600">
          <h2 className="text-lg font-bold">Modal Title</h2>
          <button className="p-1 hover:bg-muted rounded text-gray-300" onClick={handleClose}>
            &#10005;
          </button>
        </div>
        <div className="px-6 py-4">
          {seedExamToStagingMutation.isPending ? (
            <p>Seeding exams to staging in progress...</p>
          ) : (
            <p>
              This is a potentially destructive action. Are you sure you want to
              seed the staging database with the selected exams?
            </p>
          )}

          <div className="mt-4">
            <label className="text-sm font-medium">Confirmation</label>
            <input
              type="text"
              className={`w-full rounded-md border px-3 py-2 text-sm mt-1 ${
                val !== "seed staging" ? "border-red-400 bg-background" : "border-input bg-background"
              }`}
              value={val}
              onChange={handleInputChange}
            />
            <p className="text-[#c4c8d0] text-sm mt-1">
              Type "seed staging" to confirm
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-600">
          <button
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md font-medium"
            onClick={() => {
              setVal("");
              onClose();
            }}
          >
            Close
          </button>
          <button
            className="border border-yellow-500 text-yellow-400 hover:bg-yellow-500/10 px-4 py-2 rounded-md font-medium disabled:opacity-50 flex items-center gap-2"
            onClick={() => {
              setVal("");
              handleSeedSelectedToStaging();
            }}
            disabled={val !== "seed staging" || seedExamToStagingMutation.isPending}
          >
            {seedExamToStagingMutation.isPending && <Loader2 size={16} className="animate-spin" />}
            {seedExamToStagingMutation.isPending ? "Seeding..." : "Seed Staging"}
          </button>
        </div>
      </div>
    </div>
  );
}

interface SeedProductionModalProps {
  open: boolean;
  onClose: () => void;
  handleSeedSelectedToProduction: () => void;
  seedExamToProductionMutation: UseMutationResult<
    Response[],
    Error,
    string[],
    unknown
  >;
}

export function SeedProductionModal({
  open,
  onClose,
  handleSeedSelectedToProduction,
  seedExamToProductionMutation,
}: SeedProductionModalProps) {
  const [val, setVal] = useState("");

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setVal(e.target.value);
  }

  function handleClose() {
    setVal("");
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60" onClick={handleClose} />
      <div className="relative z-50 w-full max-w-lg bg-gray-700 text-white rounded-lg shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-600">
          <h2 className="text-lg font-bold">Modal Title</h2>
          <button className="p-1 hover:bg-muted rounded text-gray-300" onClick={handleClose}>
            &#10005;
          </button>
        </div>
        <div className="px-6 py-4">
          {seedExamToProductionMutation.isPending ? (
            <p>Seeding exams to production in progress...</p>
          ) : (
            <p>
              This is a potentially destructive action. Are you sure you want to
              seed the production database with the selected exams?
            </p>
          )}

          <div className="mt-4">
            <label className="text-sm font-medium">Confirmation</label>
            <input
              type="text"
              className={`w-full rounded-md border px-3 py-2 text-sm mt-1 ${
                val !== "seed production" ? "border-red-400 bg-background" : "border-input bg-background"
              }`}
              value={val}
              onChange={handleInputChange}
            />
            <p className="text-[#c4c8d0] text-sm mt-1">
              Type "seed production" to confirm
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-600">
          <button
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md font-medium"
            onClick={() => {
              setVal("");
              onClose();
            }}
          >
            Close
          </button>
          <button
            className="border border-yellow-500 text-yellow-400 hover:bg-yellow-500/10 px-4 py-2 rounded-md font-medium disabled:opacity-50 flex items-center gap-2"
            onClick={() => {
              setVal("");
              handleSeedSelectedToProduction();
            }}
            disabled={val !== "seed production" || seedExamToProductionMutation.isPending}
          >
            {seedExamToProductionMutation.isPending && <Loader2 size={16} className="animate-spin" />}
            {seedExamToProductionMutation.isPending ? "Seeding..." : "Seed Production"}
          </button>
        </div>
      </div>
    </div>
  );
}
