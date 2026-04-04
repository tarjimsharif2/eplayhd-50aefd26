import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/['']/g, '').replace(/\s+/g, ' ').trim();
}

async function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { 
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json,*/*;q=0.8',
      }
    });
    clearTimeout(timeoutId);
    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

function isSportsPerson(desc: string | undefined): boolean {
  if (!desc) return false;
  return /cricket|football|soccer|cricketer|footballer|player|athlete|sport|batsman|bowler|keeper|allrounder/i.test(desc);
}

const DEFAULT_ESPN_HEADSHOT = 'default-player-logo';

// Source 1: ESPN Public Search API (best for cricket - has real headshots)
async function tryESPN(playerName: string, sportType: string): Promise<string | null> {
  try {
    const sport = sportType === 'football' ? 'soccer' : 'cricket';
    const url = `https://site.api.espn.com/apis/common/v3/search?query=${encodeURIComponent(playerName)}&type=player&sport=${sport}&limit=5`;
    const res = await fetchWithTimeout(url, 8000);
    if (!res.ok) return null;
    
    const data = await res.json();
    const items = data?.items || [];
    
    const searchParts = normalizeName(playerName).split(' ');
    const lastName = searchParts[searchParts.length - 1];
    
    for (const item of items) {
      const itemName = normalizeName(item.displayName || '');
      if (!itemName.includes(lastName)) continue;
      
      const headshot = item.headshot?.href;
      if (headshot && !headshot.includes(DEFAULT_ESPN_HEADSHOT)) {
        console.log(`[FetchImages] ✓ ESPN: ${playerName} → ${item.displayName} (id: ${item.id})`);
        return headshot;
      }
      
      // Try constructing direct URL with player ID
      if (item.id) {
        const directUrl = `https://a.espncdn.com/i/headshots/${sport}/players/full/${item.id}.png`;
        try {
          const checkRes = await fetchWithTimeout(directUrl, 4000);
          if (checkRes.ok) {
            const contentType = checkRes.headers.get('content-type') || '';
            // Consume body
            await checkRes.arrayBuffer();
            if (contentType.includes('image')) {
              console.log(`[FetchImages] ✓ ESPN direct: ${playerName} → id ${item.id}`);
              return directUrl;
            }
          } else {
            await checkRes.text();
          }
        } catch {}
      }
    }
    
    console.log(`[FetchImages] ~ ESPN: ${playerName} - no headshot in ${items.length} results`);
  } catch (e: any) {
    console.log(`[FetchImages] ESPN error for ${playerName}: ${e.message}`);
  }
  return null;
}

// Source 2: Wikipedia direct + search
async function tryWikipedia(playerName: string, sport: string): Promise<string | null> {
  try {
    const wikiName = playerName.replace(/\s+/g, '_');
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiName)}`;
    const res = await fetchWithTimeout(url, 6000);
    
    if (res.ok) {
      const data = await res.json();
      const thumb = data.originalimage?.source || data.thumbnail?.source;
      if (thumb && (isSportsPerson(data.description) || (data.type === 'standard' && !data.description?.includes('Topics referred')))) {
        console.log(`[FetchImages] ✓ Wikipedia: ${playerName}`);
        return thumb;
      }
    }
    
    const sportTerm = sport === 'football' ? 'footballer' : 'cricketer';
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(playerName + ' ' + sportTerm)}&format=json&srlimit=3`;
    const searchRes = await fetchWithTimeout(searchUrl, 6000);
    if (searchRes.ok) {
      const searchData = await searchRes.json();
      for (const result of (searchData?.query?.search || [])) {
        const lastN = normalizeName(playerName).split(' ').pop()!;
        if (!normalizeName(result.title).includes(lastN)) continue;
        
        const sUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(result.title.replace(/\s+/g, '_'))}`;
        const sRes = await fetchWithTimeout(sUrl, 5000);
        if (sRes.ok) {
          const sd = await sRes.json();
          const t = sd.originalimage?.source || sd.thumbnail?.source;
          if (t && isSportsPerson(sd.description)) {
            console.log(`[FetchImages] ✓ Wiki Search: ${playerName} → ${result.title}`);
            return t;
          }
        }
        await new Promise(r => setTimeout(r, 150));
      }
    }
  } catch (e) {
    console.log(`[FetchImages] Wiki error for ${playerName}: ${e.message}`);
  }
  return null;
}

// Source 3: Wikidata P18 image property
async function tryWikidata(playerName: string, sport: string): Promise<string | null> {
  try {
    const sportTerm = sport === 'football' ? 'footballer' : 'cricketer';
    const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(playerName + ' ' + sportTerm)}&language=en&format=json&limit=3`;
    const res = await fetchWithTimeout(url, 6000);
    if (!res.ok) return null;
    
    const data = await res.json();
    for (const entity of (data?.search || [])) {
      if (!isSportsPerson(entity.description)) continue;
      
      const entityUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${entity.id}&props=claims|sitelinks&sitefilter=enwiki&format=json`;
      const entityRes = await fetchWithTimeout(entityUrl, 5000);
      if (!entityRes.ok) continue;
      
      const entityData = await entityRes.json();
      const entityInfo = entityData?.entities?.[entity.id];
      
      const imageClaim = entityInfo?.claims?.P18;
      if (imageClaim && imageClaim.length > 0) {
        const fileName = imageClaim[0]?.mainsnak?.datavalue?.value;
        if (fileName) {
          const encodedFile = encodeURIComponent(fileName.replace(/ /g, '_'));
          const md5 = await crypto.subtle.digest('MD5', new TextEncoder().encode(fileName.replace(/ /g, '_')));
          const hashArray = Array.from(new Uint8Array(md5));
          const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
          const imageUrl = `https://upload.wikimedia.org/wikipedia/commons/thumb/${hashHex[0]}/${hashHex.substring(0, 2)}/${encodedFile}/400px-${encodedFile}`;
          console.log(`[FetchImages] ✓ Wikidata P18: ${playerName} → ${fileName}`);
          return imageUrl;
        }
      }
      
      const enwikiTitle = entityInfo?.sitelinks?.enwiki?.title;
      if (enwikiTitle) {
        const sUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(enwikiTitle.replace(/\s+/g, '_'))}`;
        const sRes = await fetchWithTimeout(sUrl, 5000);
        if (sRes.ok) {
          const sd = await sRes.json();
          const t = sd.originalimage?.source || sd.thumbnail?.source;
          if (t) {
            console.log(`[FetchImages] ✓ Wikidata→Wiki: ${playerName} → ${enwikiTitle}`);
            return t;
          }
        }
      }
      await new Promise(r => setTimeout(r, 200));
    }
  } catch (e) {
    console.log(`[FetchImages] Wikidata error for ${playerName}: ${e.message}`);
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { matchId, sport } = await req.json();
    const sportType = sport || 'cricket';

    if (!matchId) {
      return new Response(JSON.stringify({ success: false, error: 'matchId required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: players, error: playersError } = await supabase
      .from('match_playing_xi')
      .select('id, player_name, team_id, player_image')
      .eq('match_id', matchId)
      .or('player_image.is.null,player_image.eq.');

    if (playersError) throw playersError;

    if (!players || players.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, message: 'All players already have images', updated: 0 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log(`[FetchImages] Processing ${players.length} players (sport: ${sportType})`);

    let updatedCount = 0;
    const errors: string[] = [];

    for (const player of players) {
      try {
        let imageUrl: string | null = null;

        // 1. ESPN (public API - has cricket/football headshots)
        imageUrl = await tryESPN(player.player_name, sportType);
        
        // 2. Wikipedia
        if (!imageUrl) imageUrl = await tryWikipedia(player.player_name, sportType);
        
        // 3. Wikidata P18
        if (!imageUrl) imageUrl = await tryWikidata(player.player_name, sportType);

        if (imageUrl) {
          const { error: updateError } = await supabase
            .from('match_playing_xi')
            .update({ player_image: imageUrl })
            .eq('id', player.id);
          if (!updateError) updatedCount++;
        } else {
          console.log(`[FetchImages] ✗ ${player.player_name} - no image from any source`);
        }

        await new Promise(r => setTimeout(r, 300));
      } catch (err) {
        console.warn(`[FetchImages] Error: ${player.player_name}: ${err.message}`);
        errors.push(`${player.player_name}: ${err.message}`);
      }
    }

    console.log(`[FetchImages] Complete: ${updatedCount}/${players.length} images found`);

    return new Response(JSON.stringify({
      success: true, total: players.length, updated: updatedCount,
      notFound: players.length - updatedCount,
      errors: errors.length > 0 ? errors : undefined,
      message: `${updatedCount} out of ${players.length} missing images found`
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('[FetchImages] Error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message || 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
