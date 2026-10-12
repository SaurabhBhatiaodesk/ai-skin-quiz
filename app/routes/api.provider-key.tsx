import type { ActionFunctionArgs } from 'react-router';
import { authenticate } from '../shopify.server';
import { asProvider } from '../ai-shared';
import { getAIKey } from '../settings.server';
const headers = { 'Cache-Control': 'no-store, private' };
export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  try {
    const input = await request.json();
    const key = await getAIKey(session.shop, asProvider(input.provider));
    return key ? Response.json({ key }, { headers }) : Response.json({ error: 'No API key is saved for this store.' }, { status: 404, headers });
  } catch {
    return Response.json({ error: 'Could not read the saved API key.' }, { status: 400, headers });
  }
}
export function loader() { return Response.json({ error: 'Use POST to reveal the saved API key.' }, { status: 405, headers }); }
