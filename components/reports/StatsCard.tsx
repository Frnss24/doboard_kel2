interface Props {
  title: string
  value: string | number
}

export default function StatsCard({ title, value }: Props) {
  let iconBg = "bg-blue-50";
  let iconColor = "text-blue-600";
  let iconPath = (
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  );

  if (title === "Completed") {
    iconBg = "bg-green-50";
    iconColor = "text-green-600";
    iconPath = <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />;
  } else if (title === "In Progress") {
    iconBg = "bg-orange-50";
    iconColor = "text-orange-600";
    iconPath = <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />;
  } else if (title === "Overdue") {
    iconBg = "bg-red-50";
    iconColor = "text-red-600";
    iconPath = <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />;
  }

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl border border-gray-200/80 shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className={`h-12 w-12 rounded-xl ${iconBg} flex items-center justify-center`}>
          <svg className={`h-6 w-6 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {iconPath}
          </svg>
        </div>
      </div>
      <div className="text-3xl font-bold text-gray-900">
        {value}
      </div>
      <div className="mt-1 text-sm font-medium text-gray-500">
        {title}
      </div>
    </div>
  )
}