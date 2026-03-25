import { useMutation } from "@tanstack/react-query";
import { getGenerations } from "../utils/fetch";
import { calculateGenerationMetrics } from "../utils/question";
import { useEffect } from "react";
import { Tooltip } from "./tooltip";

interface EditExamGenerationVariabilityProps {
  examId: string;
  generatedExamsStagingData?: Awaited<ReturnType<typeof getGenerations>>;
  generatedExamsProductionData?: Awaited<ReturnType<typeof getGenerations>>;
}

export function EditExamGenerationVariability({
  examId,
  generatedExamsStagingData,
  generatedExamsProductionData,
}: EditExamGenerationVariabilityProps) {
  const stagingMetricsMutation = useMutation({
    mutationKey: ["generation-metrics", examId, "Staging"],
    mutationFn: async ({
      generatedExamsStaging,
    }: {
      generatedExamsStaging: typeof generatedExamsStagingData;
    }) => {
      const metrics = calculateGenerationMetrics(generatedExamsStaging);
      return metrics;
    },
    retry: false,
  });
  const productionMetricsMutation = useMutation({
    mutationKey: ["generation-metrics", examId, "Production"],
    mutationFn: async ({
      generatedExamsProduction,
    }: {
      generatedExamsProduction: typeof generatedExamsProductionData;
    }) => {
      const metrics = calculateGenerationMetrics(generatedExamsProduction);
      return metrics;
    },
    retry: false,
  });

  useEffect(() => {
    if (generatedExamsStagingData) {
      stagingMetricsMutation.mutate({
        generatedExamsStaging: generatedExamsStagingData,
      });
    }
  }, [examId, generatedExamsStagingData]);

  useEffect(() => {
    if (generatedExamsProductionData) {
      productionMetricsMutation.mutate({
        generatedExamsProduction: generatedExamsProductionData,
      });
    }
  }, [examId, generatedExamsProductionData]);

  const stagingMetrics = stagingMetricsMutation.data;
  const productionMetrics = productionMetricsMutation.data;
  if (
    stagingMetricsMutation.isPending ||
    productionMetricsMutation.isPending ||
    stagingMetrics === undefined ||
    productionMetrics === undefined
  ) {
    return (
      <>
        <h3 className="text-sm font-bold mt-6 mb-2">Exam Generations</h3>
        <p className="mb-2">This is the analysis of the exam generations:</p>
        <div className="animate-spin rounded-full h-5 w-5 border-2 border-teal-400 border-t-transparent" />
      </>
    );
  }
  if (stagingMetricsMutation.isError || productionMetricsMutation.isError) {
    console.error(stagingMetricsMutation.error);
    console.error(productionMetricsMutation.error);
    return (
      <>
        <h3 className="text-sm font-bold mt-6 mb-2">Exam Generations</h3>
        <p className="text-gray-300 mb-2">
          This is the analysis of the exam generations:
        </p>
        <p className="text-red-400 font-bold">
          Error loading exam generations. See browser console for details.
        </p>
      </>
    );
  }

  return (
    <>
      <h3 className="text-sm font-bold mt-6 mb-2">Exam Generations</h3>
      <p className="mb-2">This is the analysis of the exam generations:</p>
      <div className="overflow-x-auto rounded-md bg-black p-2">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left text-teal-300 px-2 py-1">Variability</th>
              <th className="text-left px-2 py-1">Staging</th>
              <th className="text-left px-2 py-1">Production</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <Tooltip content="How many generations are deprecated">
                <td className="font-bold px-2 py-1">Deprecated Generations</td>
              </Tooltip>
              <td className="px-2 py-1">{stagingMetrics.deprecatedGenerations}</td>
              <td className="px-2 py-1">{productionMetrics.deprecatedGenerations}</td>
            </tr>
            <tr>
              <Tooltip content="How many non-deprecated generations exist">
                <td className="font-bold px-2 py-1">Total Generations</td>
              </Tooltip>
              <td className="px-2 py-1">{stagingMetrics.totalGenerations}</td>
              <td className="px-2 py-1">{productionMetrics.totalGenerations}</td>
            </tr>
            <tr>
              <Tooltip content="Overall question variability across all live generations. (sum of variabilities) / (number of comparisons)">
                <td className="font-bold px-2 py-1">Question Total</td>
              </Tooltip>
              <td className="px-2 py-1">{stagingMetrics.questionVariability}</td>
              <td className="px-2 py-1">{productionMetrics.questionVariability}</td>
            </tr>
            <tr>
              <Tooltip content="Maximum question variability found between any two live generations">
                <td className="font-bold px-2 py-1">Question Max</td>
              </Tooltip>
              <td className="px-2 py-1">{stagingMetrics.questionVariabilityMax}</td>
              <td className="px-2 py-1">{productionMetrics.questionVariabilityMax}</td>
            </tr>
            <tr>
              <Tooltip content="Minimum question variability found between any two live generations">
                <td className="font-bold px-2 py-1">Question Min</td>
              </Tooltip>
              <td className="px-2 py-1">{stagingMetrics.questionVariabilityMin}</td>
              <td className="px-2 py-1">{productionMetrics.questionVariabilityMin}</td>
            </tr>
            <tr>
              <Tooltip content="Overall answer variability across all live generations. (sum of variabilities) / (number of comparisons)">
                <td className="font-bold px-2 py-1">Answer Total</td>
              </Tooltip>
              <td className="px-2 py-1">{stagingMetrics.answerVariability}</td>
              <td className="px-2 py-1">{productionMetrics.answerVariability}</td>
            </tr>
            <tr>
              <Tooltip content="Maximum answer variability found between any two live generations">
                <td className="font-bold px-2 py-1">Answer Max</td>
              </Tooltip>
              <td className="px-2 py-1">{stagingMetrics.answerVariabilityMax}</td>
              <td className="px-2 py-1">{productionMetrics.answerVariabilityMax}</td>
            </tr>
            <tr>
              <Tooltip content="Minimum answer variability found between any two live generations">
                <td className="font-bold px-2 py-1">Answer Min</td>
              </Tooltip>
              <td className="px-2 py-1">{stagingMetrics.answerVariabilityMin}</td>
              <td className="px-2 py-1">{productionMetrics.answerVariabilityMin}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
