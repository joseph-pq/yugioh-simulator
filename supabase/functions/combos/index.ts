import { createClient } from 'npm:@supabase/supabase-js@2'

type Visibility = 'public' | 'unlisted'

const corsHeaders = {
  // Authorization is checked for every mutation; this header only permits the
  // static GitHub Pages client to make cross-origin requests to the function.
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
}

function response(body: unknown, status = 200, extraHeaders: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extraHeaders },
  })
}

function error(message: string, status = 400) {
  return response({ error: message }, status)
}

function mapCombo(combo: Record<string, unknown>) {
  return {
    slug: combo.slug,
    title: combo.title,
    visibility: combo.visibility,
    payload: combo.payload,
    createdAt: combo.created_at,
    updatedAt: combo.updated_at,
  }
}

function validPayload(payload: unknown): payload is Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false
  const state = payload as Record<string, unknown>
  if (!Array.isArray(state.main) || !Array.isArray(state.extra)) return false
  if (![...state.main, ...state.extra].every(value => Number.isSafeInteger(value) && (value as number) > 0)) return false
  if (state.combo !== undefined && (!Array.isArray(state.combo) || state.combo.length > 100)) return false
  return new TextEncoder().encode(JSON.stringify(payload)).length <= 64 * 1024
}

function validVisibility(value: unknown): value is Visibility {
  return value === 'public' || value === 'unlisted'
}

async function hashIp(ip: string, salt: string) {
  const data = new TextEncoder().encode(`${salt}:${ip}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const rateLimitSalt = Deno.env.get('RATE_LIMIT_SALT')
  if (!supabaseUrl || !serviceRoleKey || !rateLimitSalt) return error('Server configuration is incomplete.', 500)

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  const url = new URL(request.url)
  const functionPath = url.pathname.replace(/^.*\/combos/, '') || '/'
  const segments = functionPath.split('/').filter(Boolean)
  const authorization = request.headers.get('Authorization') || ''
  const token = authorization.replace(/^Bearer\s+/i, '')

  const getUser = async () => {
    if (!token) return null
    const { data, error: userError } = await admin.auth.getUser(token)
    return userError ? null : data.user
  }

  try {
    if (request.method === 'GET' && segments.length === 1 && segments[0] !== 'account') {
      const { data, error: queryError } = await admin.from('combos').select('slug,title,visibility,payload,created_at,updated_at').eq('slug', segments[0]).maybeSingle()
      if (queryError) throw queryError
      return data ? response(mapCombo(data)) : error('Combo not found.', 404)
    }

    const user = await getUser()
    if (!user) return error('Please sign in to manage saved combos.', 401)

    if (request.method === 'GET' && segments.length === 0) {
      const { data, error: queryError } = await admin.from('combos').select('slug,title,visibility,payload,created_at,updated_at').eq('owner_id', user.id).order('updated_at', { ascending: false })
      if (queryError) throw queryError
      return response((data || []).map(mapCombo))
    }

    if (request.method === 'POST' && segments.length === 0) {
      const body = await request.json()
      if (typeof body.title !== 'string' || body.title.trim().length === 0 || body.title.length > 80 || !validVisibility(body.visibility) || !validPayload(body.payload)) {
        return error('Invalid combo title, visibility, or payload.')
      }
      const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
      const { data, error: rpcError } = await admin.rpc('create_combo', {
        p_owner: user.id,
        p_ip_hash: await hashIp(ip, rateLimitSalt),
        p_title: body.title,
        p_visibility: body.visibility,
        p_payload: body.payload,
      })
      if (rpcError) return error(rpcError.message, 429)
      return response(mapCombo(data[0]), 201)
    }

    if (request.method === 'DELETE' && segments[0] === 'account') {
      const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
      if (deleteError) throw deleteError
      return response({ ok: true })
    }

    const slug = segments[0]
    if (!slug || !/^[A-Za-z0-9]{12}$/.test(slug)) return error('Invalid combo link.', 404)

    if (request.method === 'PATCH') {
      const body = await request.json()
      if (typeof body.title !== 'string' || body.title.trim().length === 0 || body.title.length > 80 || !validVisibility(body.visibility) || (body.payload !== undefined && !validPayload(body.payload))) {
        return error('Invalid combo update.')
      }
      const update: Record<string, unknown> = { title: body.title.trim(), visibility: body.visibility }
      if (body.payload !== undefined) update.payload = body.payload
      const { data, error: updateError } = await admin.from('combos').update(update).eq('slug', slug).eq('owner_id', user.id).select('slug,title,visibility,payload,created_at,updated_at').maybeSingle()
      if (updateError) throw updateError
      return data ? response(mapCombo(data)) : error('Combo not found.', 404)
    }

    if (request.method === 'DELETE') {
      const { data, error: deleteError } = await admin.from('combos').delete().eq('slug', slug).eq('owner_id', user.id).select('slug').maybeSingle()
      if (deleteError) throw deleteError
      return data ? response({ ok: true }) : error('Combo not found.', 404)
    }

    return error('Method not allowed.', 405)
  } catch (caught) {
    console.error(caught)
    return error('The combo service is temporarily unavailable.', 500)
  }
})
