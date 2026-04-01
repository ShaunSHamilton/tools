import { useNavigate } from "@tanstack/react-router";
import { useContext, useEffect } from "react";

import { UsersWebSocketActivityContext } from "../contexts/users-websocket";
import { LandingCard } from "../components/landing-card";
import { AttemptsLandingCard } from "../components/attempt/landing-card";
import { Header } from "../components/ui/header";
import { ExamLayout } from "../components/ExamLayout";

export function Landing() {
  const { updateActivity } = useContext(UsersWebSocketActivityContext)!;
  const navigate = useNavigate();

  useEffect(() => {
    updateActivity({
      page: new URL(window.location.href),
      lastActive: Date.now(),
    });
  }, []);

  return (
    <ExamLayout>
      <div className="py-12 px-4 flex-1">
      <div className="flex items-center justify-center">
        <div className="flex flex-col gap-8 w-full max-w-7xl">
          {/* <Flex
            justify="space-between"
            align="center"
            bg={"bg"}
            borderRadius="xl"
            p={8}
            boxShadow="lg"
            mb={4}
          >
            <Stack gap={1}>
              <Heading
                color={"fg.success"}
                fontWeight="extrabold"
                fontSize="3xl"
              >
                Exam Creator
              </Heading>
              <Text color="fg.muted" fontSize="lg">
                Create and moderate exams and attempts.
              </Text>
            </Stack>
            <UsersOnPageAvatars path="/" />
          </Flex> */}
          <Header
            title="Exam Creator"
            description="Create and moderate exams and attempts"
          />
          <div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-8">
              <button
                onClick={() => navigate({ to: "/exam-creator/exams" })}
                className="hover:shadow-xl hover:-translate-y-0.5 rounded-xl transition-all duration-150 block text-left w-full p-0 bg-muted"
              >
                <LandingCard path={"/exams"}>Exams</LandingCard>
              </button>
              <button
                onClick={() => navigate({ to: "/exam-creator/attempts" })}
                className="hover:shadow-xl hover:-translate-y-0.5 rounded-xl transition-all duration-150 block text-left w-full p-0 bg-muted"
              >
                <AttemptsLandingCard path={"/attempts"} />
              </button>
              <button
                onClick={() => navigate({ to: "/exam-creator/metrics" })}
                className="hover:shadow-xl hover:-translate-y-0.5 rounded-xl transition-all duration-150 block text-left w-full p-0 bg-muted"
              >
                <LandingCard path={"/metrics"}>Exam Metrics</LandingCard>
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>
    </ExamLayout>
  );
}
