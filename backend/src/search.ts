export interface SearchResult {
  title: string;
  description: string;
  link: string;
}

// 네이버 웹 검색 API 호출
export async function searchNaver(query: string, display = 5): Promise<SearchResult[]> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.warn("NAVER_CLIENT_ID 또는 NAVER_CLIENT_SECRET이 설정되지 않았습니다.");
    return [];
  }

  try {
    const encodedQuery = encodeURIComponent(query);
    const url = `https://openapi.naver.com/v1/search/webkr.json?query=${encodedQuery}&display=${display}&sort=sim`;

    const res = await fetch(url, {
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
      },
    });

    if (!res.ok) {
      console.error(`네이버 검색 오류: ${res.status} ${res.statusText}`);
      return [];
    }

    const data = await res.json() as { items?: { title: string; description: string; link: string }[] };
    return (data.items || []).map((item) => ({
      title: item.title.replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&"),
      description: item.description.replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&amp;/g, "&"),
      link: item.link,
    }));
  } catch (err) {
    console.error("네이버 검색 중 오류:", err);
    return [];
  }
}

export interface SearchContext {
  query: string;
  sources: SearchResult[];
  promptText: string;
}

// 아이디어 목록에서 검색 쿼리 자동 생성 + 검색 실행
export async function searchForIdeas(
  ideas: { title: string; content: string }[],
  topic?: string
): Promise<SearchContext> {
  const empty: SearchContext = { query: "", sources: [], promptText: "" };
  if (ideas.length === 0) return empty;

  const keywords = ideas.slice(0, 3).map((i) => i.title).join(" ");
  const query = topic ? `${topic} ${keywords}` : keywords;

  console.log(`🔍 네이버 검색: "${query}"`);
  const results = await searchNaver(query, 5);

  if (results.length === 0) return empty;

  const formatted = results
    .map((r, i) => `[검색결과 ${i + 1}] ${r.title}\n${r.description}`)
    .join("\n\n");

  const promptText = `\n\n=== 실시간 검색 자료 (네이버) ===\n검색어: "${query}"\n\n${formatted}\n================================`;

  return { query, sources: results, promptText };
}
