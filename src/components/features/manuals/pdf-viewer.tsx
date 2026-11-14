"use client";

import { LoaderCircle, Maximize2, Minus, Plus, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist/legacy/build/pdf.mjs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Visualizador de PDF compatível com telemóveis (PDF.js, versão "legacy").
 *  - Carrega por partes (Range): não descarrega o manual inteiro de uma vez.
 *  - Desenha só as páginas perto do ecrã e liberta as que ficam longe (memória).
 *  - Ajusta à largura do ecrã; zoom com botões.
 */

const ZOOM_STEPS = [0.75, 1, 1.25, 1.5, 2, 2.5, 3];

type Status = { kind: "loading"; progress: number } | { kind: "ready" } | { kind: "error"; message: string };

export function PdfViewer({ src, title }: { src: string; title: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "loading", progress: 0 });
  const [width, setWidth] = useState(0);
  const [zoomIndex, setZoomIndex] = useState(1);
  const [ratio, setRatio] = useState(1.414); // altura/largura (A4) até conhecer a 1.ª página
  const [currentPage, setCurrentPage] = useState(1);

  // Largura disponível
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Carregar o documento
  useEffect(() => {
    let cancelled = false;
    let destroyTask: (() => Promise<void>) | null = null;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        const task = pdfjs.getDocument({
          url: src,
          disableAutoFetch: true, // só pede as partes necessárias
          rangeChunkSize: 256 * 1024,
        });
        destroyTask = () => task.destroy();
        task.onProgress = ({ loaded: l, total }: { loaded: number; total: number }) => {
          if (!cancelled && total) setStatus({ kind: "loading", progress: Math.min(99, Math.round((l / total) * 100)) });
        };
        const loaded = await task.promise;
        if (cancelled) return;
        const first = await loaded.getPage(1);
        const vp = first.getViewport({ scale: 1 });
        setRatio(vp.height / vp.width);
        setDoc(loaded);
        setStatus({ kind: "ready" });
      } catch (e) {
        if (cancelled) return;
        const status = (e as { status?: number }).status;
        setStatus({
          kind: "error",
          message:
            status === 403
              ? "É necessária uma assinatura activa para consultar este manual."
              : status === 401
                ? "A sua sessão expirou. Entre novamente."
                : status === 404
                  ? "Este manual não foi encontrado."
                  : "Não foi possível carregar o manual. Verifique a ligação e tente novamente.",
        });
      }
    })();
    return () => {
      cancelled = true;
      void destroyTask?.();
    };
  }, [src]);

  const zoom = ZOOM_STEPS[zoomIndex];
  const pageWidth = Math.max(200, Math.floor(width * zoom));
  const onVisible = useCallback((n: number) => setCurrentPage(n), []);

  return (
    <div className="flex flex-col gap-3">
      {/* Barra de ferramentas */}
      <div
        className="sticky top-[60px] z-10 flex items-center justify-between gap-2 rounded-xl border border-border bg-card/95 px-3 py-2 shadow-sm backdrop-blur lg:top-2"
        role="toolbar"
        aria-label="Controlos do manual"
      >
        <p className="text-sm tabular-nums text-muted-foreground" aria-live="polite">
          {doc ? (
            <>
              Página <span className="font-semibold text-foreground">{currentPage}</span> de {doc.numPages}
            </>
          ) : (
            "A carregar…"
          )}
        </p>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" aria-label="Diminuir zoom" disabled={!doc || zoomIndex === 0} onClick={() => setZoomIndex((z) => z - 1)}>
            <Minus className="size-4" aria-hidden />
          </Button>
          <span className="w-12 text-center text-sm tabular-nums">{Math.round(zoom * 100)}%</span>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Aumentar zoom"
            disabled={!doc || zoomIndex === ZOOM_STEPS.length - 1}
            onClick={() => setZoomIndex((z) => z + 1)}
          >
            <Plus className="size-4" aria-hidden />
          </Button>
          <Button variant="ghost" size="sm" aria-label="Ajustar à largura" disabled={!doc || zoomIndex === 1} onClick={() => setZoomIndex(1)}>
            <Maximize2 className="size-4" aria-hidden />
          </Button>
        </div>
      </div>

      <div ref={containerRef} className="w-full overflow-x-auto rounded-xl bg-muted/60 p-0 sm:p-3">
        {status.kind === "loading" && (
          <div className="flex flex-col items-center gap-3 py-20 text-sm text-muted-foreground" role="status">
            <LoaderCircle className="size-8 animate-spin text-primary" aria-hidden />A carregar o manual
            {status.progress > 0 && ` (${status.progress}%)`}…
          </div>
        )}
        {status.kind === "error" && (
          <div className="flex flex-col items-center gap-3 px-4 py-16 text-center" role="alert">
            <TriangleAlert className="size-8 text-warning" aria-hidden />
            <p className="max-w-sm text-sm">{status.message}</p>
          </div>
        )}
        {doc && width > 0 && (
          <div className="mx-auto flex flex-col items-center gap-3" style={{ width: pageWidth }} aria-label={`Manual: ${title}`}>
            {Array.from({ length: doc.numPages }, (_, i) => (
              <PdfPage key={i + 1} doc={doc} pageNumber={i + 1} width={pageWidth} ratio={ratio} onVisible={onVisible} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PdfPage({
  doc,
  pageNumber,
  width,
  ratio,
  onVisible,
}: {
  doc: PDFDocumentProxy;
  pageNumber: number;
  width: number;
  ratio: number;
  onVisible: (n: number) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [near, setNear] = useState(pageNumber <= 2);
  const [height, setHeight] = useState(Math.round(width * ratio));
  const [rendered, setRendered] = useState(false);

  // Perto do ecrã? (desenhar) — longe? (libertar memória)
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setNear(entry.isIntersecting), { rootMargin: "1500px 0px" });
    const current = new IntersectionObserver(([entry]) => entry.isIntersecting && onVisible(pageNumber), {
      threshold: 0.5,
    });
    io.observe(el);
    current.observe(el);
    return () => {
      io.disconnect();
      current.disconnect();
    };
  }, [pageNumber, onVisible]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!near) {
      // Libertar a memória do canvas (importante em telemóveis)
      canvas.width = 0;
      canvas.height = 0;
      return;
    }
    let task: RenderTask | null = null;
    let cancelled = false;
    (async () => {
      const page = await doc.getPage(pageNumber);
      if (cancelled) return;
      setRendered(false);
      const base = page.getViewport({ scale: 1 });
      const scale = width / base.width;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: scale * dpr });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
      canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;
      setHeight(Math.floor(viewport.height / dpr));
      task = page.render({ canvas, viewport });
      try {
        await task.promise;
        if (!cancelled) setRendered(true);
      } catch {
        // render cancelado (ex.: mudança de zoom) — ignorar
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, pageNumber, width, near]);

  return (
    <div
      ref={wrapperRef}
      className="relative overflow-hidden bg-white shadow-sm"
      style={{ width, height }}
      data-page={pageNumber}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={`Página ${pageNumber}`}
        className={cn("block", !(rendered && near) && "opacity-0")}
      />
      {!(rendered && near) && (
        <span className="absolute inset-0 flex items-center justify-center text-xs text-neutral-400">
          Página {pageNumber}
        </span>
      )}
    </div>
  );
}
