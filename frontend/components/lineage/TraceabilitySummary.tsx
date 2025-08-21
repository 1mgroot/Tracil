import type { LineageGraph } from '@/types/lineage'

interface TraceabilitySummaryProps {
  lineage: LineageGraph
}

export function TraceabilitySummary({ lineage }: TraceabilitySummaryProps) {
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
              {lineage.gaps.notes.map((note) => (
                <li key={note} className="text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-md border border-amber-200">
                  {note}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
