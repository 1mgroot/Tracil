import { useEffect } from 'react'
import type { LineageGraph } from '@/types/lineage'

interface TraceabilitySummaryProps {
  lineage: LineageGraph
}

export function TraceabilitySummary({ lineage }: TraceabilitySummaryProps) {
  // Debug: Log gaps data using useEffect
  useEffect(() => {
    console.log('🔍 Debug - Full lineage object:', lineage)
    console.log('🔍 Debug - Summary:', lineage.summary)
    console.log('🔍 Debug - Summary type:', typeof lineage.summary)
    console.log('🔍 Debug - Summary length:', lineage.summary?.length)
    
    if (lineage.gaps?.notes) {
      console.log('🔍 Debug - Gaps data:', lineage.gaps.notes)
      console.log('🔍 Debug - Gaps data length:', lineage.gaps.notes.length)
      console.log('🔍 Debug - Gaps data types:', lineage.gaps.notes.map((note, i) => ({ index: i, note, type: typeof note })))
    }
  }, [lineage])

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        AI-Generated Traceability Summary
      </h2>
      
      <div className="space-y-4">
        <div>
          <p className="text-gray-700 leading-relaxed">
            {lineage.summary}
          </p>
        </div>
        
        {lineage.gaps?.notes && lineage.gaps.notes.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-900 mb-2">
              Gaps & Notes
            </h3>
            <ul className="space-y-1">
              {lineage.gaps.notes.map((note, index) => {
                // Debug: Log each note and its index
                console.log(`🔍 Debug - Note ${index}:`, note)
                // Create a unique key that combines note content and index
                const uniqueKey = `gap-${index}-${note.substring(0, 20).replace(/[^a-zA-Z0-9]/g, '-')}`
                return (
                  <li key={uniqueKey} className="text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-md border border-amber-200">
                    {note}
                  </li>
                )
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
