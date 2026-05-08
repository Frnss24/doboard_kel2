interface RecentActivityProps {
  activities: string[]
}

export default function RecentActivity({ activities }: RecentActivityProps) {
  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/80 shadow-sm p-6 hover:shadow-md transition-shadow">
      <h3 className="text-base font-bold text-gray-900 mb-6">
        Recent Activity
      </h3>

      <div className="relative border-l-2 border-gray-100 ml-3 space-y-6">
        {activities.length > 0 ? (
          activities.map((item, i) => (
            <div key={i} className="relative pl-6">
              <div className="absolute -left-[9px] top-1.5 h-4 w-4 rounded-full border-4 border-white bg-blue-500 shadow-sm"></div>
              <p className="text-sm font-medium text-gray-700 leading-snug">{item}</p>
            </div>
          ))
        ) : (
          <div className="text-sm text-gray-400 pl-4">
            Belum ada aktivitas dari task milik kamu.
          </div>
        )}
      </div>
    </div>
  )
}