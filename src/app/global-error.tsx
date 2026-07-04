'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center font-sans">
        <h1 className="text-2xl font-semibold">Application error</h1>
        <p className="max-w-md text-gray-600">
          The application encountered a critical error. Please reload the page.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-md bg-black px-4 py-2 text-sm text-white"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
