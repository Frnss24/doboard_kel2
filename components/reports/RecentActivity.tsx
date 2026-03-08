export default function RecentActivity() {

  const activities = [
    "Completed Fix mobile navigation bug",
    "Completed Update pricing page copy",
    "Started Implement dark mode",
    "Started API rate limiting middleware",
    "Created Write Q1 performance report"
  ]

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">

      <h3 className="text-sm font-semibold text-gray-900 mb-4">
        Recent Activity
      </h3>

      <div className="space-y-3">

        {activities.map((item, i) => (
          <div key={i} className="text-sm text-gray-600">
            {item}
          </div>
        ))}

      </div>

    </div>
  )
}