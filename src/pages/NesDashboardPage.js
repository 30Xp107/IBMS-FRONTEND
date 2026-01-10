import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FileText, PieChart as PieChartIcon, TrendingUp, Info } from "lucide-react";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = ["#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#6366f1"];

const NesDashboardPage = () => {
  const { api, user } = useAuth();
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const res = await api.get("/dashboard/nes-stats");
      setStats(res.data);
    } catch (error) {
      toast.error("Failed to load NES dashboard data");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner" />
      </div>
    );
  }

  const attendanceData = stats?.attendanceStats?.map(item => ({
    name: item._id === "present" ? "Present" : item._id === "absent" ? "Absent" : "None",
    value: item.count
  })) || [];

  const trendData = stats?.periodStats?.map(item => ({
    period: item._id,
    count: item.count
  })).reverse() || [];

  const reasonData = stats?.reasonStats?.map(item => ({
    name: item._id,
    count: item.count
  })) || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">NES Dashboard</h1>
        <p className="text-slate-500 dark:text-slate-400">
          Detailed overview of Walang Gutom Program NES records.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-violet-600" />
              Attendance Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={attendanceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {attendanceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-violet-600" />
              NES Trends
            </CardTitle>
            <CardDescription>NES records over the last 12 periods</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="period" />
                <YAxis />
                <RechartsTooltip />
                <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Info className="w-5 h-5 text-violet-600" />
              Top Non-Attendance Reasons
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {reasonData.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{item.name}</span>
                  <div className="flex items-center gap-4 flex-1 ml-4">
                    <div className="h-2 flex-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-violet-500" 
                        style={{ width: `${(item.count / stats.totalNES) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold w-8 text-right">{item.count}</span>
                  </div>
                </div>
              ))}
              {reasonData.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-4">No reason data available</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-violet-100 rounded-lg">
                <FileText className="w-6 h-6 text-violet-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Total NES Records</p>
                <p className="text-2xl font-bold">{stats?.totalNES || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default NesDashboardPage;
