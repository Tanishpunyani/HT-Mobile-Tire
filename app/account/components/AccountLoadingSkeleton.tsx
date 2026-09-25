import Container from "@/app/components/Container";

export default function AccountLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background-light">
      <section className="bg-secondary py-20">
        <Container>
          <div className="mx-auto max-w-4xl text-center">
            <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-primary" />
            <p className="mt-4 text-sm font-semibold text-slate-300">
              Loading Your Account Profile...
            </p>
          </div>
        </Container>
      </section>
    </div>
  );
}
