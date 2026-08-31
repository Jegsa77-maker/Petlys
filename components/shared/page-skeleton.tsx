export function PageSkeleton() {
  return (
    <main className="min-h-screen bg-offwhite px-4 py-8">
      <div className="max-w-md mx-auto flex flex-col gap-4 animate-pulse">
        <div className="h-7 w-40 bg-gray rounded-lg" />
        <div className="h-24 bg-gray rounded-lg" />
        <div className="h-24 bg-gray rounded-lg" />
        <div className="h-24 bg-gray rounded-lg" />
      </div>
    </main>
  );
}
