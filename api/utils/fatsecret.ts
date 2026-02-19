// Helper to stringify URL parameters (replacing qs.stringify)
function stringifyParams(params: Record<string, any>): string {
  return new URLSearchParams(params).toString();
}

const FATSECRET_KEY = process.env.FATSECRET_KEY || '';
const FATSECRET_SECRET = process.env.FATSECRET_SECRET || '';

let fatSecretToken: { access_token: string, expires_at: number } | null = null;

export async function getFatSecretToken() {
  if (fatSecretToken && fatSecretToken.expires_at > Date.now()) {
    return fatSecretToken.access_token;
  }
  const res = await fetch('https://oauth.fatsecret.com/connect/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: stringifyParams({
      grant_type: 'client_credentials',
      scope: 'basic',
      client_id: FATSECRET_KEY,
      client_secret: FATSECRET_SECRET,
    }),
  });
  if (!res.ok) throw new Error('FatSecret token fetch failed');
  const data = await res.json();
  fatSecretToken = {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in - 60) * 1000, // 1 min buffer
  };
  return fatSecretToken.access_token;
}

export async function searchFatSecretIngredients(query: string, maxResults = 50) {
  const token = await getFatSecretToken();
  const params = stringifyParams({
    method: 'foods.search',
    search_expression: query,
    max_results: maxResults,
    format: 'json',
  });
  const res = await fetch(`https://platform.fatsecret.com/rest/server.api?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('FatSecret search failed');
  const data = await res.json();
  return data.foods?.food || [];
}

export async function getFatSecretFood(foodId: string) {
  const token = await getFatSecretToken();
  const params = stringifyParams({
    method: 'food.get',
    food_id: foodId,
    format: 'json',
  });
  const res = await fetch(`https://platform.fatsecret.com/rest/server.api?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('FatSecret food.get failed');
  const data = await res.json();
  return data.food;
}
