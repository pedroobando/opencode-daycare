import type { NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/proxy'

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder assets (svg, png, jpg, jpeg, gif, webp)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

export const proxy = async (request: NextRequest) => {
  const { supabaseResponse } = await updateSession(request)

  // IMPORTANT: Do not run code between updateSession and returning the
  // response, or the session may not be refreshed for the render.

  return supabaseResponse
}
