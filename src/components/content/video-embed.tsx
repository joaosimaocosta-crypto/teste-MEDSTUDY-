import { ExternalLink, PlayCircle } from "lucide-react";

/**
 * Converte um link de vídeo num endereço "embed" conhecido.
 * Só YouTube (modo de privacidade reforçada) e Vimeo; outros ficam como link.
 */
export function toEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    let id: string | null = null;
    if (host === "youtube.com") {
      id = u.pathname.startsWith("/embed/") || u.pathname.startsWith("/shorts/")
        ? u.pathname.split("/")[2]
        : u.searchParams.get("v");
    } else if (host === "youtu.be") {
      id = u.pathname.slice(1);
    }
    if (id && /^[\w-]{6,20}$/.test(id)) return `https://www.youtube-nocookie.com/embed/${id}`;

    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const vid = u.pathname.split("/").filter(Boolean).pop();
      if (vid && /^\d+$/.test(vid)) return `https://player.vimeo.com/video/${vid}`;
    }
  } catch {
    // URL inválido → tratado como link simples
  }
  return null;
}

export function VideoEmbed({ url, title }: { url: string; title: string }) {
  const embed = toEmbedUrl(url);
  if (!embed) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 rounded-card border border-border bg-card p-4 font-medium hover:bg-muted"
      >
        <PlayCircle className="size-6 text-primary" aria-hidden />
        Ver vídeo da aula
        <ExternalLink className="ml-auto size-4 text-muted-foreground" aria-hidden />
      </a>
    );
  }
  return (
    <div className="aspect-video w-full overflow-hidden rounded-card border border-border bg-black">
      <iframe
        src={embed}
        title={`Vídeo: ${title}`}
        className="size-full"
        loading="lazy"
        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
        allowFullScreen
      />
    </div>
  );
}
