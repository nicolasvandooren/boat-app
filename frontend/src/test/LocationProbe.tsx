import { useLocation } from 'react-router'

/** Renders the router location so tests can assert where navigation went. */
export function LocationProbe() {
  const location = useLocation()
  return <span data-testid="location">{location.pathname + location.search}</span>
}
