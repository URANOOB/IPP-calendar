"use client";

import { useEffect, useRef, useState } from "react";

import { searchPlatform, type PlatformSearchResult } from "@/app/(dashboard)/dashboard/platform-actions";
import Link from "next/link";

export function GlobalSearch() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlatformSearchResult[]>([]);
  const [isPending, setIsPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        if (isOpen && query.trim() === "") {
          setIsOpen(false);
        }
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, query]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  // Handle search with debounce
  useEffect(() => {
    if (!isOpen) return;
    
    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
    timeoutRef.current = setTimeout(async () => {
      const trimmed = query.trim();
      
      // If less than 2 characters, clear results
      if (trimmed.length < 2) {
        setResults([]);
        setIsPending(false);
        return;
      }

      // Set pending state
      setIsPending(true);

      try {
        const searchResults = await searchPlatform(trimmed);
        setResults(searchResults);
      } catch (error) {
        console.error("Search error:", error);
        setResults([]);
      } finally {
        setIsPending(false);
      }
    }, 180);

    // Cleanup function
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [query, isOpen]);

  function toggleSearch() {
    if (!isOpen) {
      setIsOpen(true);
    } else if (query.trim() === "") {
      setIsOpen(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      if (query.trim() === "") {
        setIsOpen(false);
      } else {
        setQuery("");
        setResults([]);
      }
    }
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Search container with sliding animation */}
      <div 
        className={`
          flex items-center gap-2
          transition-all duration-300 ease-out
          ${isOpen ? "w-[280px] opacity-100" : "w-10 opacity-100"}
        `}
      >
        {/* Search Icon Button - always visible */}
        <button
          type="button"
          onClick={toggleSearch}
          className={`
            flex-shrink-0 flex items-center justify-center
            w-10 h-10 rounded-full
            bg-muted/60 hover:bg-muted/80
            text-muted-foreground hover:text-foreground
            transition-colors duration-200
            focus:outline-none focus:ring-2 focus:ring-ring/50
          `}
          aria-label={isOpen ? "Cerrar búsqueda" : "Abrir búsqueda"}
          aria-expanded={isOpen}
        >
          <svg 
            viewBox="0 0 24 24" 
            aria-hidden="true" 
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </button>

        {/* Search Input - slides in when open */}
        {isOpen && (
          <div className={`
            flex-1 min-w-0 overflow-hidden
            animate-slide-in
          `}>
            <div className="relative flex items-center">
              {/* Hidden search icon for alignment */}
              <svg 
                viewBox="0 0 24 24" 
                aria-hidden="true" 
                className="absolute left-3 top-1/2 -translate-y-1/2 size-5 text-muted-foreground"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              
              {/* Search Input */}
              <input
                type="search"
                className={`
                  w-full h-9 pl-10 pr-4 bg-muted/50 border border-transparent
                  rounded-full text-sm text-foreground placeholder:text-muted-foreground
                  focus:bg-background focus:border-primary/30 focus:ring-2 focus:ring-ring/20
                  transition-all duration-200
                `}
                placeholder="Buscar nombres, clases, ciclos, profesores…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                ref={inputRef}
                aria-label="Buscar nombres, clases, ciclos, profesores"
                autoComplete="off"
              />
              
              {/* Clear button */}
              {query && (
                <button
                  type="button"
                  onClick={() => { setQuery(""); setResults([]); inputRef.current?.focus(); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Limpiar búsqueda"
                >
                  <svg className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              )}
              
              {/* Loading indicator */}
              {isPending && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 size-4 animate-spin text-muted-foreground" />
              )}
            </div>
            
            {/* Results dropdown */}
            {(!isPending && results.length > 0 && query.trim().length >= 2) && (
              <div className="absolute left-0 right-0 mt-1 w-full max-w-xs border border-border bg-card/95 backdrop-blur rounded-xl shadow-lg z-50 animate-fade-in">
                {results.map((result) => (
                  <Link 
                    key={`${result.type}-${result.id}`} 
                    href={result.href} 
                    className="block px-4 py-2.5 text-sm hover:bg-muted transition-colors"
                    onClick={() => { setIsOpen(false); setQuery(""); setResults([]); }}
                  >
                    <div className="flex justify-between gap-2">
                      <div className="min-w-0">
                        <strong className="block truncate text-foreground">{result.label}</strong>
                        <small className="block text-xs text-muted-foreground truncate">{result.description}</small>
                      </div>
                      <span className="flex-shrink-0 text-xs px-2 py-0.5 bg-muted/50 text-muted-foreground rounded-full">{result.type}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            
            {/* No results message */}
            {(!isPending && results.length === 0 && query.trim().length >= 2) && (
              <div className="absolute left-0 right-0 mt-1 w-full max-w-xs border border-border bg-card/95 backdrop-blur rounded-xl shadow-lg z-50 animate-fade-in">
                <p className="px-4 py-2.5 text-xs text-muted-foreground">No encontramos resultados para “{query}”.</p>
              </div>
            )}
            
            {/* Prompt for minimum characters */}
            {(query.trim().length > 0 && query.trim().length < 2) && (
              <div className="absolute left-0 right-0 mt-1 w-full max-w-xs border border-border bg-card/95 backdrop-blur rounded-xl shadow-lg z-50 animate-fade-in">
                <p className="px-4 py-2.5 text-xs text-muted-foreground">Escribe al menos dos caracteres para buscar.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Global styles for animations */}
      <style jsx>{`
        @keyframes slide-in {
          from {
            width: 0;
            opacity: 0;
            padding-left: 0;
            padding-right: 0;
          }
          to {
            width: 100%;
            opacity: 1;
          }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-slide-in {
          animation: slide-in 0.25s ease-out forwards;
        }
        .animate-fade-in {
          animation: fade-in 0.15s ease-out forwards;
        }
      `}</style>
    </div>
  );
}