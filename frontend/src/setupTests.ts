import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Vitest runs without globals, so Testing Library cannot register its automatic cleanup.
afterEach(cleanup)

// jsdom does not implement scrolling; Layout scrolls to the top after navigation.
window.scrollTo = () => undefined
