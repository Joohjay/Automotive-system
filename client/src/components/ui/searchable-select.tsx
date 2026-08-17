import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Loader2, Plus } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface SearchableOption {
  id: string
  label: string
  sublabel?: string
}

interface SearchableSelectProps {
  value: string
  onChange: (value: string) => void
  onSearch: (query: string) => Promise<SearchableOption[]>
  onCreateNew?: (query: string) => void
  placeholder?: string
  emptyText?: string
  createNewLabel?: string
  disabled?: boolean
  className?: string
}

export function SearchableSelect({
  value,
  onChange,
  onSearch,
  onCreateNew,
  placeholder = 'Type to search…',
  emptyText = 'No results found',
  createNewLabel = '+ Add new',
  disabled = false,
  className,
}: SearchableSelectProps) {
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<SearchableOption[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const [selectedLabel, setSelectedLabel] = useState('')

  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const totalOptions = options.length + (onCreateNew && query.trim() ? 1 : 0)

  const doSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setOptions([])
        setLoading(false)
        return
      }
      setLoading(true)
      try {
        const results = await onSearch(q.trim())
        setOptions(results)
      } catch {
        setOptions([])
      } finally {
        setLoading(false)
      }
    },
    [onSearch],
  )

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => void doSearch(query), 250)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, doSearch])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function focus() {
    if (!disabled) {
      inputRef.current?.focus()
      setOpen(true)
    }
  }

  function selectOption(opt: SearchableOption) {
    onChange(opt.id)
    setSelectedLabel(opt.label)
    setQuery('')
    setOptions([])
    setOpen(false)
    setHighlightedIndex(-1)
  }

  function handleCreate() {
    if (onCreateNew && query.trim()) {
      onCreateNew(query.trim())
      setQuery('')
      setOptions([])
      setOpen(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setOpen(true)
        return
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightedIndex((i) => (i < totalOptions - 1 ? i + 1 : 0))
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightedIndex((i) => (i > 0 ? i - 1 : totalOptions - 1))
        break
      case 'Enter':
        e.preventDefault()
        if (highlightedIndex >= 0 && highlightedIndex < options.length) {
          selectOption(options[highlightedIndex])
        } else if (onCreateNew && highlightedIndex === options.length && query.trim()) {
          handleCreate()
        }
        break
      case 'Escape':
        setOpen(false)
        setHighlightedIndex(-1)
        break
    }
  }

  useEffect(() => {
    if (highlightedIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-option]')
      items[highlightedIndex]?.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightedIndex])

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <input type="hidden" value={value} />
      <div
        className="flex h-9 cursor-pointer items-center rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors hover:bg-accent/50"
        onClick={focus}
      >
        {value && selectedLabel ? (
          <span className="truncate">{selectedLabel}</span>
        ) : (
          <span className="text-muted-foreground truncate">{placeholder}</span>
        )}
      </div>

      {open && !disabled && (
        <div className="absolute z-50 mt-1 max-h-64 w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
          <div className="border-b p-1.5">
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                className="h-8 w-full rounded border-0 bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"
                placeholder="Search…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setHighlightedIndex(-1)
                }}
                onKeyDown={handleKeyDown}
                autoFocus
              />
              {loading && (
                <Loader2 className="text-muted-foreground absolute top-1/2 right-2 size-3.5 -translate-y-1/2 animate-spin" />
              )}
            </div>
          </div>

          <div ref={listRef} className="overflow-y-auto max-h-48 p-1">
            {options.length === 0 && !loading && !onCreateNew ? (
              <div className="px-3 py-2 text-center text-xs text-muted-foreground">{emptyText}</div>
            ) : (
              <>
                {options.map((opt, i) => (
                  <div
                    key={opt.id}
                    data-option
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm',
                      highlightedIndex === i && 'bg-accent',
                      opt.id === value && 'font-medium',
                    )}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      selectOption(opt)
                    }}
                    onMouseEnter={() => setHighlightedIndex(i)}
                  >
                    <Check className={cn('size-3.5 shrink-0', opt.id === value ? 'opacity-100' : 'opacity-0')} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{opt.label}</div>
                      {opt.sublabel && (
                        <div className="text-muted-foreground truncate text-xs">{opt.sublabel}</div>
                      )}
                    </div>
                  </div>
                ))}

                {onCreateNew && query.trim() && (
                  <div
                    data-option
                    className={cn(
                      'flex cursor-pointer items-center gap-2 rounded-sm border-t px-2 py-1.5 text-sm',
                      highlightedIndex === options.length && 'bg-accent',
                    )}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      handleCreate()
                    }}
                    onMouseEnter={() => setHighlightedIndex(options.length)}
                  >
                    <Plus className="size-3.5 shrink-0 text-primary" />
                    <span className="text-primary font-medium">{createNewLabel} "{query.trim()}"</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
