'use client'

export function PrintPageButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="text-sm text-white/80 hover:text-white border border-white/25 rounded-lg px-3 py-1.5"
    >
      Imprimir / PDF
    </button>
  )
}
