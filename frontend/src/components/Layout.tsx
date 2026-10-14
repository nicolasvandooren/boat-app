import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from 'react-oidc-context'
import { useEffect, useRef } from 'react'
import { Link, Outlet, useLocation } from 'react-router'
import styles from './Layout.module.css'

export function Layout() {
  const auth = useAuth()
  const queryClient = useQueryClient()
  const { pathname } = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const previousPathname = useRef(pathname)

  // After client-side navigation to another page, move focus to the new content so keyboard and screen
  // reader users start there (a full page load does this by itself). Query-string changes (search,
  // pagination) keep focus where it is.
  useEffect(() => {
    if (previousPathname.current === pathname) return
    previousPathname.current = pathname
    window.scrollTo(0, 0)
    // A page can name a better starting point (e.g. a "Boat added." confirmation) with data-focus-on-navigate.
    const target = mainRef.current?.querySelector<HTMLElement>('[data-focus-on-navigate]')
    ;(target ?? mainRef.current)?.focus()
  }, [pathname])

  const signOut = () => {
    // Drop private data before leaving; Keycloak then returns to /signed-out.
    queryClient.clear()
    void auth.signoutRedirect()
  }

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <header className={styles.header}>
        <div className={styles.bar}>
          <Link className={styles.brand} to="/boats">
            <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 3v15M8 7h8M5 13c0 4 3 6 7 6s7-2 7-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle cx="12" cy="4" r="1.5" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            The Boat App
          </Link>
          {auth.isAuthenticated && (
            <div className={styles.account}>
              <span>
                Signed in as <strong>{auth.user?.profile.preferred_username}</strong>
              </span>
              <button type="button" onClick={signOut}>
                Log out
              </button>
            </div>
          )}
        </div>
      </header>
      <main id="main" ref={mainRef} className={styles.main} tabIndex={-1}>
        <Outlet />
      </main>
    </>
  )
}
