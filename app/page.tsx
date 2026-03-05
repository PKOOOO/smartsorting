"use client";

import { useEffect, useState } from "react";

type Classification = {
  id?: number;
  created_at?: string;
  label: string;
  confidence?: number | null;
  reason?: string | null;
  camera_url?: string | null;
};

const DEFAULT_CAM_URL = "http://192.168.1.41"; // Fallback if auto-detect fails

export default function Home() {
  const [camUrl, setCamUrl] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [current, setCurrent] = useState<Classification | null>(null);
  const [history, setHistory] = useState<Classification[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastBase64, setLastBase64] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch("/api/camera-info", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as { ip?: string | null };
          if (data.ip && typeof data.ip === "string") {
            setCamUrl(data.ip);
          } else {
            setCamUrl(DEFAULT_CAM_URL);
          }
        } else {
          setCamUrl(DEFAULT_CAM_URL);
        }
      } catch {
        setCamUrl(DEFAULT_CAM_URL);
      }

      void loadHistory();
    }

    void init();
  }, []);

  async function loadHistory() {
    try {
      const res = await fetch("/api/history", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as Classification[];
      setHistory(data);
    } catch {
      // ignore history errors in UI
    }
  }

  async function handleCapture() {
    try {
      setCapturing(true);
      setError(null);

      // 1) Fetch JPEG directly from ESP32‑CAM (CORS is enabled on the device)
      const res = await fetch(camUrl, { cache: "no-store" });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Camera error: ${res.status} ${text}`);
      }
      const blob = await res.blob();

      const objectUrl = URL.createObjectURL(blob);
      setImageSrc(objectUrl);

      // Convert to base64 and store it for later analysis
      const base64 = await blobToBase64(blob);
      setLastBase64(base64);
      setCurrent(null);
    } catch (err: any) {
      console.error(err);
      setError(String(err?.message || err));
    } finally {
      setCapturing(false);
    }
  }

  async function handleAnalyse() {
    try {
      if (!lastBase64) {
        setError("Capture a photo first before analysing.");
        return;
      }

      setLoading(true);
      setError(null);

      // Call backend AI classifier with the last captured frame
      const classifyRes = await fetch("/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: lastBase64, cameraUrl: camUrl }),
      });

      if (!classifyRes.ok) {
        const text = await classifyRes.text();
        throw new Error(`API error: ${classifyRes.status} ${text}`);
      }

      const data = (await classifyRes.json()) as Classification;
      setCurrent(data);
      void loadHistory();
    } catch (err: any) {
      console.error(err);
      setError(String(err?.message || err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-50">
      <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10 lg:px-10">
        {/* Top header */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            <p className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Live AI demo • Smart E‑Waste Sorting
            </p>
            <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Smart E‑Waste Sorting Dashboard
            </h1>
            <p className="max-w-2xl text-sm text-zinc-300">
              Capture an item with the ESP32‑CAM, then analyse it with the AI
              model to decide whether it&apos;s a{" "}
              <span className="font-medium text-emerald-200">
                cable, phone, battery, or PCB
              </span>{" "}
              and which bin it belongs in.
            </p>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs sm:mt-0 sm:justify-end">
            <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-3 py-1 text-zinc-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              ESP32‑CAM online
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-zinc-700 px-3 py-1 text-zinc-300">
              Model: <span className="font-semibold">Gemini 2.5 Flash</span>
            </span>
          </div>
        </header>

        {/* Controls */}
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 shadow-sm backdrop-blur sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex-1 space-y-2">
              <label className="block text-xs font-medium uppercase tracking-wide text-zinc-400">
                ESP32‑CAM URL
              </label>
              <input
                className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none ring-0 transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/40"
                value={camUrl}
                onChange={(e) => setCamUrl(e.target.value)}
              />
              <p className="text-xs text-zinc-500">
                Example: <code>http://192.168.1.41</code> — your camera&apos;s IP
                on the same Wi‑Fi.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                onClick={handleCapture}
                disabled={capturing || loading}
                className="inline-flex flex-1 items-center justify-center rounded-full bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-emerald-950 shadow-sm transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-700 sm:flex-none sm:px-6"
              >
                {capturing ? "Capturing…" : "Capture"}
              </button>
              <button
                onClick={handleAnalyse}
                disabled={loading || !lastBase64}
                className="inline-flex flex-1 items-center justify-center rounded-full border border-zinc-600 px-4 py-2.5 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-none sm:px-6"
              >
                {loading ? "Analysing…" : "Analyse"}
              </button>
            </div>
          </div>
          {error && (
            <p className="mt-3 text-sm text-red-400">Error: {error}</p>
          )}
        </section>

        {/* Main content */}
        <section className="grid gap-6 md:grid-cols-2">
          {/* Camera */}
          <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 shadow-sm backdrop-blur sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
                Camera View
              </h2>
              {imageSrc ? (
                <span className="text-xs text-zinc-400">
                  Last captured frame
                </span>
              ) : (
                <span className="text-xs text-zinc-500">
                  No frame captured yet
                </span>
              )}
            </div>
            <div className="flex h-64 items-center justify-center overflow-hidden rounded-xl border border-dashed border-zinc-700 bg-zinc-950">
              {imageSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageSrc}
                  alt="ESP32-CAM frame"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <span className="px-6 text-center text-sm text-zinc-500">
                  Point the ESP32‑CAM at an item and click{" "}
                  <span className="font-medium text-emerald-300">
                    Capture
                  </span>{" "}
                  to take a photo.
                </span>
              )}
            </div>
          </div>

          {/* Classification */}
          <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 shadow-sm backdrop-blur sm:p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
              Classification
            </h2>
            {current ? (
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-zinc-400">
                      Predicted label
                    </p>
                    <span className="inline-flex items-center rounded-full bg-zinc-800 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-200">
                      {current.label}
                    </span>
                  </div>
                  {current.confidence != null && (
                    <div className="text-right">
                      <p className="text-xs font-medium text-zinc-400">
                        Confidence
                      </p>
                      <p className="text-base font-semibold text-zinc-50">
                        {(current.confidence * 100).toFixed(1)}%
                      </p>
                    </div>
                  )}
                </div>
                {current.reason && (
                  <div>
                    <p className="text-xs font-medium text-zinc-400">
                      Why the model chose this
                    </p>
                    <p className="mt-0.5 text-sm text-zinc-200">
                      {current.reason}
                    </p>
                  </div>
                )}
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-emerald-300">
                    Suggested bin
                  </p>
                  <p className="mt-1 text-sm font-semibold text-emerald-100">
                    {binForLabel(current.label)}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-zinc-500">
                No classification yet. Capture a photo, then click{" "}
                <span className="font-medium text-emerald-300">Analyse</span> to
                see how the AI would sort it.
              </p>
            )}
          </div>
        </section>

        {/* History */}
        <section className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 shadow-sm backdrop-blur sm:mb-8 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
              Recent classifications
            </h2>
            {history.length > 0 && (
              <span className="text-xs text-zinc-500">
                Showing last {history.length} samples
              </span>
            )}
          </div>
          {history.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">
              No history yet. Classify a few items to build a timeline for your
              demo.
            </p>
          ) : (
            <ul className="mt-3 space-y-1.5 text-sm">
              {history.map((h) => (
                <li
                  key={h.id ?? `${h.label}-${h.created_at}`}
                  className="flex items-baseline justify-between gap-4 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2"
                >
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide">
                        {h.label}
                      </span>
                      {h.confidence != null && (
                        <span className="text-[11px] text-zinc-400">
                          {(h.confidence * 100).toFixed(0)}% confident
                        </span>
                      )}
                    </div>
                    {h.reason && (
                      <span className="text-xs text-zinc-400 line-clamp-2">
                        {h.reason}
                      </span>
                    )}
                  </div>
                  <div className="text-right text-[11px] text-zinc-500">
                    {h.created_at && (
                      <div>
                        {new Date(h.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function binForLabel(label: string): string {
  switch (label) {
    case "cable":
      return "Cables & Chargers Bin";
    case "phone":
      return "Small Electronics Bin";
    case "battery":
      return "Battery Recycling Bin";
    case "pcb":
      return "Electronic Scrap / PCB Bin";
    default:
      return "Manual inspection";
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1] || "";
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

