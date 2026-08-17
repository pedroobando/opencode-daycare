interface SectionDividerProps {
  label: string;
}

export const SectionDivider = ({ label }: SectionDividerProps) => {
  return (
    <div className="mb-3.5 flex items-center gap-3.5">
      <span className="text-xs font-extrabold uppercase tracking-wide text-muted-dark">
        {label}
      </span>
      <span className="h-px flex-1 bg-divider" />
    </div>
  );
};
