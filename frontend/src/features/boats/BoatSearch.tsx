import { useEffect, useEffectEvent, useId, useState, type SubmitEvent } from 'react'
import styles from './BoatsPage.module.css'

const DEBOUNCE_MS = 300

interface BoatSearchProps {
  /** The search currently in the URL. */
  search: string
  onSearch: (search: string) => void
}

export function BoatSearch({ search, onSearch }: BoatSearchProps) {
  const inputId = useId()
  const [value, setValue] = useState(search)
  // The last value this component sent; URL updates that merely echo it must not touch the input.
  const [sent, setSent] = useState(search)
  const [urlSearch, setUrlSearch] = useState(search)

  // The URL changed from outside (back/forward, "Clear search" elsewhere): show it in the input.
  if (search !== urlSearch) {
    setUrlSearch(search)
    if (search !== sent) {
      setSent(search)
      setValue(search)
    }
  }

  const send = (next: string) => {
    setSent(next)
    onSearch(next)
  }
  const sendAfterDebounce = useEffectEvent(send)

  useEffect(() => {
    const next = value.trim()
    if (next === sent) return undefined
    const timer = setTimeout(() => {
      sendAfterDebounce(next)
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
    }
  }, [value, sent])

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault()
    const next = value.trim()
    if (next !== sent) send(next)
  }

  return (
    <form role="search" className={styles.search} onSubmit={submit}>
      <label htmlFor={inputId}>Search boats</label>
      <div className={styles.searchRow}>
        <input
          id={inputId}
          type="search"
          value={value}
          placeholder="Name or description"
          autoComplete="off"
          maxLength={200}
          onChange={(event) => {
            setValue(event.target.value)
          }}
        />
        {value && (
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => {
              setValue('')
              send('')
            }}
          >
            Clear
          </button>
        )}
      </div>
    </form>
  )
}
