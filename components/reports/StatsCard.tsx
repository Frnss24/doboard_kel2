interface Props {
  title: string
  value: string | number
}

export default function StatsCard({ title, value }: Props) {

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">

      <div className="flex items-center justify-between mb-3">
        <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
          <div className="h-4 w-4 bg-blue-500 rounded"></div>
        </div>

        <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
          +12%
        </span>
      </div>

      <div className="text-2xl font-bold text-gray-900">
        {value}
      </div>

      <div className="text-sm text-gray-500">
        {title}
      </div>

    </div>
  )
}