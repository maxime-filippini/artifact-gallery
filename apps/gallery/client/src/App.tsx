import { useEffect, useState } from "react";

type ArtifactLocation = "archive" | "queue";

interface ReviewArtifact {
  description?: string;
  location: ArtifactLocation;
  name: string;
  thumbnail?: string;
  title: string;
  url: string;
}

interface ArtifactIndex {
  archive: ReviewArtifact[];
  queue: ReviewArtifact[];
}

function thumbnailUrl(artifact: ReviewArtifact): string | undefined {
  return artifact.thumbnail
    ? new URL(artifact.thumbnail, artifact.url).toString()
    : undefined;
}

function ArtifactCard({ artifact }: { artifact: ReviewArtifact }) {
  const thumbnail = thumbnailUrl(artifact);
  const initials = artifact.title.slice(0, 2).toUpperCase();

  return (
    <a
      className="grid min-h-27 grid-cols-[5.4rem_minmax(0,1fr)] overflow-hidden rounded-2xl border border-stone-200 bg-white transition hover:border-emerald-300 hover:shadow-sm focus-visible:border-emerald-700 focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 focus-visible:outline-none sm:grid-cols-[7rem_minmax(0,1fr)]"
      href={artifact.url}
    >
      <div
        className="flex items-center justify-center bg-linear-to-br from-emerald-100 to-emerald-300 text-2xl font-medium text-emerald-950"
        aria-hidden="true"
      >
        {thumbnail ? (
          <img className="h-full w-full object-cover" src={thumbnail} alt="" />
        ) : (
          <span>{initials}</span>
        )}
      </div>
      <div className="flex min-w-0 flex-col p-3.5 justify-center">
        <h3 className="text-base leading-tight font-semibold wrap-break-word text-stone-900">
          {artifact.title}
        </h3>

        <p className="mt-1 text-sm leading-snug wrap-break-word text-stone-600">
          {artifact.description || "No description."}
        </p>
      </div>
    </a>
  );
}

function ArtifactSection({
  title,
  artifacts,
}: {
  title: string;
  artifacts: ReviewArtifact[];
}) {
  return (
    <section
      aria-labelledby={`${title.toLowerCase().replaceAll(" ", "-")}-heading`}
    >
      <div className="mb-3 flex items-baseline justify-between">
        <h2
          className="text-xl font-semibold tracking-tight text-stone-900"
          id={`${title.toLowerCase().replaceAll(" ", "-")}-heading`}
        >
          {title}
        </h2>
        <span className="text-sm text-stone-500">{artifacts.length}</span>
      </div>
      {artifacts.length ? (
        <div className="grid gap-3">
          {artifacts.map((artifact) => (
            <ArtifactCard artifact={artifact} key={artifact.name} />
          ))}
        </div>
      ) : (
        <p className="text-sm leading-relaxed text-stone-500">
          Nothing here yet.
        </p>
      )}
    </section>
  );
}

export function App() {
  const [index, setIndex] = useState<ArtifactIndex>();
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/artifacts", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Could not load artifacts");
        return response.json() as Promise<ArtifactIndex>;
      })
      .then(setIndex)
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError")
          return;
        setError(true);
      });
    return () => controller.abort();
  }, []);

  return (
    <main className="mx-auto min-h-screen max-w-2xl bg-stone-50 px-5 py-12 text-stone-900 sm:px-8 sm:py-16">
      {error ? (
        <p className="pt-10 text-sm leading-relaxed text-stone-600">
          The artifact library could not be loaded. Try refreshing.
        </p>
      ) : !index ? (
        <p className="pt-10 text-sm leading-relaxed text-stone-600">
          Loading artifacts…
        </p>
      ) : (
        <div className="grid gap-11">
          <ArtifactSection title="Review Queue" artifacts={index.queue} />
          <ArtifactSection title="Review Archive" artifacts={index.archive} />
        </div>
      )}
    </main>
  );
}
