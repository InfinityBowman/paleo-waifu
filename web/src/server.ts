import handler, { createServerEntry } from '@tanstack/react-start/server-entry'

const CANONICAL_DOMAIN = 'paleowaifu.com'

export default createServerEntry({
  async fetch(request, opts) {
    const url = new URL(request.url)

    // Redirect non-canonical domains to the canonical one (301 permanent)
    if (
      url.hostname !== CANONICAL_DOMAIN &&
      url.hostname !== 'localhost' &&
      !url.hostname.startsWith('127.')
    ) {
      url.hostname = CANONICAL_DOMAIN
      url.protocol = 'https:'
      return new Response(null, {
        status: 301,
        headers: { Location: url.toString() },
      })
    }

    return handler.fetch(request, opts)
  },
})
