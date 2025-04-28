import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"

export function DashboardOverview() {
  const leaveTypes = [
    {
      title: "Annual Leave",
      description: "Regular paid time off",
      used: 12,
      total: 25,
      color: "bg-purple-600",
    },
    {
      title: "Sick Leave",
      description: "Medical absence",
      used: 3,
      total: 10,
      color: "bg-blue-500",
    },
    {
      title: "Personal Leave",
      description: "Personal matters",
      used: 1,
      total: 5,
      color: "bg-emerald-500",
    },
  ]

  return (
    <>
      {leaveTypes.map((leave) => (
        <Card key={leave.title} className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle>{leave.title}</CardTitle>
            <CardDescription>{leave.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">
                {leave.used} used of {leave.total} days
              </span>
              <span className="text-sm font-medium">{Math.round((leave.used / leave.total) * 100)}%</span>
            </div>
            <Progress value={(leave.used / leave.total) * 100} className="h-2" indicatorClassName={leave.color} />
            <div className="mt-4 text-sm">
              <span className="font-medium">{leave.total - leave.used} days</span> remaining
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  )
}
