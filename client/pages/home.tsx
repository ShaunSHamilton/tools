export function HomePage() {
  const apps = [
    {
      title: "Exam Creator",
      description: "Build and manage exams, review attempts, and track metrics.",
      href: "/exam-creator",
      color: "from-teal-500/20 to-teal-600/10 border-teal-500/30 hover:border-teal-400/60",
      iconColor: "text-teal-400",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
      ),
    },
    {
      title: "Team Board",
      description: "Collaborate with your team, track progress, and manage projects.",
      href: "/team-board",
      color: "from-violet-500/20 to-violet-600/10 border-violet-500/30 hover:border-violet-400/60",
      iconColor: "text-violet-400",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
        </svg>
      ),
    },
    {
      title: "Task Tracker",
      description: "Generate AI-powered activity reports and share them with your organisation.",
      href: null,
      color: "from-sky-500/10 to-sky-600/5 border-sky-500/15 opacity-50 cursor-not-allowed",
      iconColor: "text-sky-400/60",
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-4xl space-y-12">
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-extrabold tracking-tight">freeCodeCamp Tools</h1>
          <p className="text-muted-foreground text-lg">Select an app to get started.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {apps.map((app) => {
            const inner = (
              <>
                <div className={`${app.iconColor}`}>{app.icon}</div>
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold">{app.title}</h2>
                  <p className="text-muted-foreground text-sm leading-relaxed">{app.description}</p>
                </div>
                <div className="mt-auto flex items-center gap-1 text-sm font-medium text-muted-foreground">
                  {app.href ? (
                    <>
                      Open
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 transition-transform group-hover:translate-x-0.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                      </svg>
                    </>
                  ) : (
                    <span>Coming soon</span>
                  )}
                </div>
              </>
            );

            return app.href ? (
              <a
                key={app.title}
                href={app.href}
                className={`group relative flex flex-col gap-4 rounded-xl border bg-gradient-to-br ${app.color} p-6 transition-colors duration-200`}
              >
                {inner}
              </a>
            ) : (
              <div
                key={app.title}
                className={`relative flex flex-col gap-4 rounded-xl border bg-gradient-to-br ${app.color} p-6`}
              >
                {inner}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
