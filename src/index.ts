export {};

declare global {
  interface CacheStorage {
    default: Cache;
  }

  interface RequestInit {
    cf?: {
      cacheEverything?: boolean;
      cacheTtl?: number;
    };
  }
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/').filter(Boolean);

    if (pathParts.length < 3) {
      return new Response('Usage: /:user/:repo/...path', { status: 400 });
    }

    const [user, repo, ...assetPath] = pathParts;

    const rawHost = "raw.githubusercontent.com";
    const githubHost = "github.com";
    const cache = caches.default;

    const cacheKey = new Request(request.url, {
      method: request.method,
      headers: request.headers,
    });

    const cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) return cachedResponse;

    let targetUrl: string;

    if (assetPath[0] === "releases" && assetPath[1] === "download") {
      targetUrl = `https://${githubHost}/${user}/${repo}/releases/download/${assetPath.slice(2).join("/")}`;
    } else {
      const branch = "main"; // or extract from query if needed
      targetUrl = `https://${rawHost}/${user}/${repo}/${branch}/${assetPath.join("/")}`;
    }

    const githubRes = await fetch(targetUrl, {
      cf: {
        cacheEverything: true,
        cacheTtl: 3600,
      },
    });

    if (!githubRes.ok) {
      return new Response(`Failed to fetch from GitHub: ${githubRes.status}`, { status: githubRes.status });
    }

    const response = new Response(githubRes.body, githubRes);
    response.headers.set("Cache-Control", "public, max-age=3600");

    await cache.put(cacheKey, response.clone());

    return response;
  },
};
