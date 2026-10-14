import { useEffect } from 'react'

/** Gives each page a distinct browser tab title (WCAG 2.4.2). */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = `${title} – The Boat App`
  }, [title])
}
