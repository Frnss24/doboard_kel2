interface RecentActivityProps {
  activities: string[]
}

export default function RecentActivity({ activities }: RecentActivityProps) {

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">

      <h3 className="text-sm font-semibold text-gray-900 mb-4">
        Recent Activity
      </h3>

      <div className="space-y-3">

        {activities.length > 0 ? (
          activities.map((item, i) => (
            <div key={i} className="text-sm text-gray-600">
              {item}
            </div>
          ))
        ) : (
          <div className="text-sm text-gray-400">
            Belum ada aktivitas dari task milik kamu.
          </div>
        )}

      </div>

    </div>
  )
}