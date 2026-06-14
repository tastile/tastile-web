'use client'

export function UsageDashboard() {
  const placeholderCharts = [
    {
      title: 'Tiles Over Time',
      description: 'Track tile creation and completion trends'
    },
    {
      title: 'Completion Rate',
      description: 'Monitor your productivity over time'
    },
    {
      title: 'Focus Time',
      description: 'Total time spent on work segments'
    },
    {
      title: 'Activity Heatmap',
      description: 'Visual breakdown of your most productive times'
    }
  ]

  return (
    <div className="space-y-6">
      <div className="p-4 bg-primary/10 rounded-lg">
        <p className="text-sm text-primary">
          <strong>Coming Soon:</strong> Analytics dashboard with charts and insights about your tile usage and productivity patterns.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {placeholderCharts.map((chart, index) => (
          <div
            key={index}
            className="p-6 bg-surface-2 rounded-lg min-h-[200px] flex flex-col"
          >
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground mb-2">{chart.title}</h3>
              <p className="text-sm text-foreground-muted mb-4">{chart.description}</p>

              {/* Placeholder Chart Area */}
              <div className="h-32 bg-surface-1 rounded flex items-center justify-center">
                <div className="text-center">
                  <div className="text-3xl text-foreground-muted mb-2">📊</div>
                  <p className="text-xs text-foreground-muted">Chart placeholder</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-6 bg-surface-2 rounded-lg">
        <h3 className="text-lg font-semibold text-foreground mb-2">Planned Features</h3>
        <ul className="space-y-2 text-sm text-foreground-muted">
          <li className="flex items-start gap-2">
            <span className="text-foreground-muted mt-1">•</span>
            <span>Interactive time-series graphs for tile completion over days, weeks, and months</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-foreground-muted mt-1">•</span>
            <span>Heatmap visualization showing most productive hours and days</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-foreground-muted mt-1">•</span>
            <span>Focus time breakdown by project, label, and semantic role</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-foreground-muted mt-1">•</span>
            <span>Completion rate trends with weekly and monthly comparisons</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-foreground-muted mt-1">•</span>
            <span>Export data to CSV for external analysis</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
