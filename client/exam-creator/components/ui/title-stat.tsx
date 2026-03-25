interface TitleStateProps {
  title: string;
  stat: string | number;
}

export function TitleStat({ title, stat }: TitleStateProps) {
  return (
    <div className="bg-background border border-muted rounded-md p-3 cursor-help">
      <p className="text-xs font-bold text-primary">{title}</p>
      <p className="text-lg font-bold text-green-500">{stat}</p>
    </div>
  );
}
