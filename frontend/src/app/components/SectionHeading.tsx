type SectionHeadingProps = {
  title: string;
  description?: string;
  eyebrow?: string;
  centered?: boolean;
};

export default function SectionHeading({
  title,
  description,
  eyebrow,
  centered = false,
}: SectionHeadingProps) {
  return (
    <div className={`${centered ? "mx-auto text-center" : ""} max-w-2xl`}>
      {eyebrow && (
        <p className="mb-3 text-sm font-semibold uppercase tracking-wider text-primary">
          {eyebrow}
        </p>
      )}

      <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
        {title}
      </h2>

      {description && (
        <p className="mt-4 text-base leading-7 text-text-secondary sm:text-lg">
          {description}
        </p>
      )}
    </div>
  );
}