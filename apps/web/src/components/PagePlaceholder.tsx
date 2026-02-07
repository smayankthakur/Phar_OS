type PagePlaceholderProps = {
  title: string;
};

export function PagePlaceholder({ title }: PagePlaceholderProps) {
  return (
    <section className="content-card">
      <h2>{title}</h2>
      <p>Coming in Step XX.</p>
    </section>
  );
}
