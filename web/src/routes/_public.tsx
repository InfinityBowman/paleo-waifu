import { Link, Outlet, createFileRoute } from '@tanstack/react-router'
import { Nav } from '@/components/layout/Nav'

export const Route = createFileRoute('/_public')({
  component: PublicLayout,
})

function PublicLayout() {
  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Nav />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
        <footer className="border-t border-white/[0.03] py-6 text-center">
          <div className="flex items-center justify-center gap-4">
            <a
              href="https://ko-fi.com/jacobmaynard"
              target="_blank"
              rel="noopener noreferrer"
              className="text-lavender/40 transition-colors hover:text-primary/60"
              aria-label="Support on Ko-fi"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.881 8.948c-.773-4.085-4.859-4.593-4.859-4.593H.723c-.604 0-.679.798-.679.798s-.082 7.324-.022 11.822c.164 2.424 2.586 2.672 2.586 2.672s8.267-.023 11.966-.049c2.438-.426 2.683-2.566 2.658-3.734 4.352.24 7.422-2.831 6.649-6.916zm-11.062 3.511c-1.246 1.453-4.011 3.976-4.011 3.976s-.121.119-.31.023c-.076-.057-.108-.09-.108-.09-.443-.441-3.368-3.049-4.034-3.954-.709-.965-1.041-2.7-.091-3.71.951-1.01 3.005-1.086 4.363.407 0 0 1.565-1.782 3.468-.963 1.904.82 1.832 3.011.723 4.311zm6.173.478c-.928.116-1.682.028-1.682.028V7.284h1.77s1.971.551 1.971 2.638c0 1.913-.985 2.667-2.059 3.015z" />
              </svg>
            </a>
            <span className="font-hand text-[10px] text-lavender/55">
              PaleoWaifu
            </span>
            <a
              href="https://discord.com/oauth2/authorize?client_id=1476736375771365539&permissions=19456&integration_type=0&scope=bot+applications.commands"
              target="_blank"
              rel="noopener noreferrer"
              className="text-lavender/40 transition-colors hover:text-[#5865F2]/60"
              aria-label="Add bot to Discord"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.947 2.418-2.157 2.418z" />
              </svg>
            </a>
          </div>
          <div className="mt-2 flex items-center justify-center gap-3 text-[10px] text-lavender/40">
            <Link
              to="/updates"
              className="transition-colors hover:text-lavender/50"
            >
              Updates
            </Link>
            <span>·</span>
            <Link
              to="/privacy"
              className="transition-colors hover:text-lavender/50"
            >
              Privacy
            </Link>
            <span>·</span>
            <Link
              to="/terms"
              className="transition-colors hover:text-lavender/50"
            >
              Terms
            </Link>
          </div>
        </footer>
      </main>
    </div>
  )
}
