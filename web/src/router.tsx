import { createRouteMask, createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

const creatureModalMask = createRouteMask({
  routeTree,
  from: '/encyclopedia/$creatureSlug/modal',
  to: '/encyclopedia/$creatureSlug',
  params: true,
  unmaskOnReload: true,
})

export const getRouter = () => {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreloadStaleTime: 30_000,
    routeMasks: [creatureModalMask],
  })

  return router
}
