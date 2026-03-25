import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { putGenerateExam } from "../utils/fetch";
import { queryClient } from "@/router";
import { toaster } from "./toaster";

interface GenerateModalProps {
  open: boolean;
  onClose: () => void;
  examId: string;
}

export function GenerateModal({ open, onClose, examId }: GenerateModalProps) {
  const [val, setVal] = useState("");
  const [count, setCount] = useState<number>(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generationAlgorithmErrors, setGenerationAlgorithmErrors] = useState<
    string[]
  >([]);
  const [progress, setProgress] = useState(0);
  const [databaseEnvironment, setDatabaseEnvironment] = useState<
    "Staging" | "Production"
  >("Staging");
  const abortRef = useRef<AbortController | null>(null);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setVal(e.target.value);
  }

  // Reset state when modal opens/closes
  useEffect(() => {
    if (open) {
      setProgress(0);
      setError(null);
      setGenerationAlgorithmErrors([]);
      setIsGenerating(false);
      setCount(1);
      abortRef.current = new AbortController();
    } else {
      abortRef.current?.abort();
      abortRef.current = null;
    }
  }, [open, examId]);

  function clampCount(n: number) {
    if (Number.isNaN(n)) return 1;
    return Math.max(1, Math.min(100, Math.floor(n)));
  }

  // Helper: iterate JSON NL from ReadableStream
  async function* iterateJsonLines(
    stream: ReadableStream<Uint8Array<ArrayBuffer>>,
  ) {
    const textDecoder = new TextDecoder("utf-8");
    const reader = stream.getReader();

    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        buffer += textDecoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (!line) continue;
          try {
            yield JSON.parse(line);
          } catch {
            // ignore invalid line
          }
        }
      }
    }
    if (buffer.trim().length > 0) {
      try {
        yield JSON.parse(buffer);
      } catch {
        /* ignore */
      }
    }
    return;
  }

  async function startGeneration() {
    setIsGenerating(true);
    setError(null);
    setGenerationAlgorithmErrors([]);

    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const stream = await putGenerateExam({
        examId,
        count,
        databaseEnvironment,
      });
      let latest = 0;
      const genErrors: string[] = [];
      for await (const msg of iterateJsonLines(stream)) {
        // Server sends { count: i (1-based), examId, error?: string | null }
        const soFar = msg.count;
        latest = soFar;
        setProgress(soFar);
        const error = msg.error;
        if (error) {
          genErrors.push(error);
        }
      }
      // Ensure we mark complete if stream ended without last line
      // Stream can timeout before all generations are done
      const isAllExamsGenerated = latest >= count;

      if (!isAllExamsGenerated) {
        if (latest === 0) {
          const uniqueErrors = Array.from(new Set(genErrors));
          setGenerationAlgorithmErrors(uniqueErrors);
        }
        toaster.create({
          title: `Generation Timeout in ${databaseEnvironment}`,
          description: `Generation process timed out before all exams could be generated. Please try again.`,
          type: "warning",
          duration: 7000,
          closable: true,
        });
      } else {
        toaster.create({
          title: `Generated Exams to ${databaseEnvironment}`,
          description: `All generated exams have been seeded to the database.`,
          type: "success",
          duration: 5000,
          closable: true,
        });
      }
      await queryClient.refetchQueries({
        queryKey: ["generated-exams", examId, databaseEnvironment],
      });
    } catch (e: unknown) {
      console.error(e);
      if (e instanceof DOMException && e.name === "AbortError") {
        setError("Generation aborted");
      } else if (e instanceof Error) {
        setError(e.message);
      } else if (typeof e === "string") {
        setError(e);
      } else {
        setError("Generation failed. Unknown error - See console.");
      }
    } finally {
      setIsGenerating(false);
    }
  }

  function handleClose() {
    setVal("");
    setCount(1);
    setIsGenerating(false);
    setError(null);
    setGenerationAlgorithmErrors([]);
    onClose();
  }

  if (!open) return null;

  const percent = count > 0 ? ((progress ?? 0) / count) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60" onClick={handleClose} />
      <div className="relative z-50 w-full max-w-lg bg-gray-700 text-white rounded-lg shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-600">
          <h2 className="text-lg font-bold">
            Generate Exams to {databaseEnvironment}
          </h2>
          <button
            className="p-1 hover:bg-muted rounded text-gray-300"
            onClick={handleClose}
          >
            &#10005;
          </button>
        </div>
        <div className="px-6 py-4">
          {isGenerating ? (
            <p>
              Generating exams to {databaseEnvironment} in progress... This
              will timeout if the input number of generations is not generated
              in 10s.
            </p>
          ) : (
            <p>
              This is a potentially destructive action. Are you sure you want to
              generate the {databaseEnvironment} database with the selected
              exams?
            </p>
          )}
          <div className="flex flex-col gap-3 mt-3">
            <div className="flex flex-col gap-1">
              <p className="text-sm text-gray-300">{examId}</p>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-yellow-500 h-2 rounded-full transition-all"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="text-xs text-gray-400">
                {progress ?? 0}/{count}
              </p>
            </div>
          </div>
          {error && <p className="mt-3 text-red-300">{error}</p>}
          {generationAlgorithmErrors.length > 0 && (
            <div className="flex flex-col gap-2 mt-3">
              <p className="text-orange-300">
                Some errors occurred during generation:
              </p>
              {generationAlgorithmErrors.map((err, idx) => (
                <p key={idx} className="text-orange-200 text-sm">
                  - {err}
                </p>
              ))}
            </div>
          )}
          <div className={`mt-4 ${isGenerating ? "opacity-50 pointer-events-none" : ""}`}>
            <label className="text-sm font-medium">Database Environment</label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              onChange={(e) => {
                const value = e.currentTarget.value as
                  | "Staging"
                  | "Production";
                setDatabaseEnvironment(value);
              }}
              value={databaseEnvironment}
            >
              <option value="Staging">Staging</option>
              <option value="Production">Production</option>
            </select>
          </div>

          <div className={`mt-4 ${isGenerating ? "opacity-50 pointer-events-none" : ""}`}>
            <label className="text-sm font-medium">Confirmation</label>
            <input
              type="text"
              className={`w-full rounded-md border px-3 py-2 text-sm ${
                val !== `generate ${databaseEnvironment}`
                  ? "border-red-400 bg-background"
                  : "border-input bg-background"
              }`}
              value={val}
              onChange={handleInputChange}
            />
            <p className="text-[#c4c8d0] text-sm mt-1">
              Type "generate {databaseEnvironment}" to confirm
            </p>
          </div>

          <div className={`mt-4 ${isGenerating ? "opacity-50 pointer-events-none" : ""}`}>
            <label className="text-sm font-medium">Number of Generations</label>
            <input
              type="number"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              min={1}
              max={100}
              value={count}
              onChange={(e) => {
                const next = clampCount(Number(e.target.value));
                setCount(next);
              }}
              disabled={isGenerating}
            />
            <p className="text-[#c4c8d0] text-sm mt-1">
              Enter a value between 1 and 100
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-600">
          <button
            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md font-medium disabled:opacity-50"
            onClick={() => {
              setVal("");
              setCount(1);
              onClose();
            }}
            disabled={isGenerating}
          >
            Close
          </button>
          <button
            className="border border-yellow-500 text-yellow-400 hover:bg-yellow-500/10 px-4 py-2 rounded-md font-medium disabled:opacity-50 flex items-center gap-2"
            onClick={async () => {
              setVal("");
              await startGeneration();
            }}
            disabled={
              val !== `generate ${databaseEnvironment}` ||
              !examId ||
              isGenerating ||
              count < 1 ||
              count > 100
            }
          >
            {isGenerating && <Loader2 size={16} className="animate-spin" />}
            {isGenerating ? "Generating..." : `Generate in ${databaseEnvironment}`}
          </button>
        </div>
      </div>
    </div>
  );
}
