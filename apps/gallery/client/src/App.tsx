import { useCallback, useEffect, useState } from "react";

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

interface ArtifactIndexResponse extends ArtifactIndex {
  csrfToken: string;
}

type ArtifactAction = "restore" | "review";

function thumbnailUrl(artifact: ReviewArtifact): string | undefined {
  return artifact.thumbnail
    ? new URL(artifact.thumbnail, artifact.url).toString()
    : undefined;
}

function ArtifactCard({
  artifact,
  actioning,
  onAction,
}: {
  artifact: ReviewArtifact;
  actioning: boolean;
  onAction: (artifact: ReviewArtifact, action: ArtifactAction) => void;
}) {
  const thumbnail = thumbnailUrl(artifact);
  const initials = artifact.title.slice(0, 2).toUpperCase();
  const action: ArtifactAction = artifact.location === "queue" ? "review" : "restore";
  const actionLabel = action === "review" ? "Mark reviewed" : "Restore";

  return (
    <article className="relative grid min-h-27 grid-cols-[5.4rem_minmax(0,1fr)] overflow-hidden rounded-2xl border border-stone-200 bg-white transition hover:border-emerald-300 hover:shadow-sm sm:grid-cols-[7rem_minmax(0,1fr)]" aria-busy={actioning}>
      <a className="absolute inset-0 rounded-2xl focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 focus-visible:outline-none" href={artifact.url} aria-label={`Open ${artifact.title}`} />
      <div
        className="row-span-2 flex pointer-events-none items-center justify-center bg-linear-to-br from-emerald-100 to-emerald-300 text-2xl font-medium text-emerald-950"
        aria-hidden="true"
      >
        {thumbnail ? (
          <img className="h-full w-full object-cover" src={thumbnail} alt="" />
        ) : (
          <span>{initials}</span>
        )}
      </div>
      <div className="pointer-events-none flex min-w-0 flex-col justify-center p-3.5 pb-1">
        <h3 className="text-base leading-tight font-semibold wrap-break-word text-stone-900">
          {artifact.title}
        </h3>

        <p className="mt-1 text-sm leading-snug wrap-break-word text-stone-600">
          {artifact.description || "No description."}
        </p>
      </div>
      <button className="relative z-10 col-start-2 mb-3.5 ml-3.5 w-fit rounded-full border border-emerald-800 px-3 py-1.5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-800 hover:text-white disabled:cursor-wait disabled:opacity-60" type="button" onClick={() => onAction(artifact, action)} disabled={actioning}>
        {actioning ? "Updating…" : actionLabel}
      </button>
    </article>
  );
}

function ArtifactSection({
  title,
  artifacts,
  actioning,
  onAction,
}: {
  title: string;
  artifacts: ReviewArtifact[];
  actioning?: string;
  onAction: (artifact: ReviewArtifact, action: ArtifactAction) => void;
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
            <ArtifactCard artifact={artifact} actioning={actioning === artifact.name} key={artifact.name} onAction={onAction} />
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
  const [csrfToken, setCsrfToken] = useState<string>();
  const [actioning, setActioning] = useState<string>();
  const [actionError, setActionError] = useState<string>();
  const [error, setError] = useState(false);

  const loadIndex = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch("/api/artifacts", { signal });
    if (!response.ok) throw new Error("Could not load artifacts");
    const data = await response.json() as ArtifactIndexResponse;
    setIndex(data);
    setCsrfToken(data.csrfToken);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadIndex(controller.signal)
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError")
          return;
        setError(true);
      });
    return () => controller.abort();
  }, [loadIndex]);

  const handleAction = async (artifact: ReviewArtifact, action: ArtifactAction) => {
    if (!csrfToken) return;
    setActioning(artifact.name);
    setActionError(undefined);
    try {
      const response = await fetch(`/api/artifacts/${encodeURIComponent(artifact.name)}/${action}`, {
        method: "POST",
        headers: { "X-CSRF-Token": csrfToken },
      });
      if (!response.ok) throw new Error("Could not update artifact");
      await loadIndex();
    } catch {
      setActionError("Could not update this artifact. Try again.");
    } finally {
      setActioning(undefined);
    }
  };

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
          {actionError && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{actionError}</p>}
          <ArtifactSection title="Review Queue" artifacts={index.queue} actioning={actioning} onAction={handleAction} />
          <ArtifactSection title="Review Archive" artifacts={index.archive} actioning={actioning} onAction={handleAction} />
        </div>
      )}
    </main>
  );
}
