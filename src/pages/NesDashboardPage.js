import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { FileText, PieChart as PieChartIcon, TrendingUp, Info, MapPin, Clock } from "lucide-react";
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
    period: item.period,
    attended: item.attended,
    target: item.target
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
            <CardDescription>Target vs Validated NES records over the last 12 periods</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="period" />
                <YAxis />
                <RechartsTooltip />
                <Legend />
                <Bar name="Attended" dataKey="attended" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                <Bar name="Target" dataKey="target" fill="#e2e8f0" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* FRM Period Monitoring Table */}
        <Card className="border-stone-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50/50 dark:bg-slate-800/30 border-b dark:border-slate-800">
            <CardTitle className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Clock className="w-5 h-5 text-violet-600" />
              FRM Period Monitoring
            </CardTitle>
            <CardDescription className="text-sm dark:text-slate-400 mt-1">
              Program performance across different periods
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                    <TableHead className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-xs py-4 px-6">FRM Period</TableHead>
                    <TableHead className="text-right font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-xs py-4 px-6">Target</TableHead>
                    <TableHead className="text-right font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider text-xs py-4 px-6">Attended</TableHead>
                    <TableHead className="text-right font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider text-xs py-4 px-6">Absent</TableHead>
                    <TableHead className="text-right font-bold text-blue-600 dark:text-blue-500 uppercase tracking-wider text-xs py-4 px-6">Remaining</TableHead>
                    <TableHead className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-xs py-4 px-6 w-[150px]">Completion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats?.periodStats?.map((item, index) => {
                    const completion = item.target > 0 ? Math.round((item.attended / item.target) * 100) : 0;
                    return (
                      <TableRow key={index} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors border-b dark:border-slate-800">
                        <TableCell className="font-bold text-slate-800 dark:text-slate-200 py-4 px-6">{item.period}</TableCell>
                        <TableCell className="text-right font-medium text-slate-600 dark:text-slate-400 py-4 px-6">{item.target.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-bold text-violet-600 dark:text-violet-400 py-4 px-6">{item.attended.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-bold text-amber-600 dark:text-amber-500 py-4 px-6">{item.absent.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-bold text-blue-600 dark:text-blue-500 py-4 px-6">{item.remaining.toLocaleString()}</TableCell>
                        <TableCell className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold w-10">{completion}%</span>
                            <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full bg-violet-500" style={{ width: `${completion}%` }} />
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

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
                        style={{ width: `${(item.count / (stats?.totalNES || 1)) * 100}%` }}
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

      {/* Municipality Breakdown Table */}
      <Card className="border-stone-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/50 dark:bg-slate-800/30 border-b dark:border-slate-800">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-violet-600" />
                Municipality Monitoring
              </CardTitle>
              <CardDescription className="text-sm dark:text-slate-400 mt-1">
                NES progress per municipality for the current period
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                  <TableHead className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-xs py-4 px-6">Municipality</TableHead>
                  <TableHead className="text-right font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-xs py-4 px-6">Target</TableHead>
                  <TableHead className="text-right font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider text-xs py-4 px-6">Attended</TableHead>
                  <TableHead className="text-right font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider text-xs py-4 px-6">Absent</TableHead>
                  <TableHead className="text-right font-bold text-blue-600 dark:text-blue-500 uppercase tracking-wider text-xs py-4 px-6">Remaining</TableHead>
                  <TableHead className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-xs py-4 px-6 w-[200px]">Completion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats?.municipalityBreakdown?.map((item, index) => {
                  const completion = item.target > 0 ? Math.round((item.attended / item.target) * 100) : 0;
                  
                  return (
                    <TableRow key={index} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors border-b dark:border-slate-800">
                      <TableCell className="font-bold text-slate-800 dark:text-slate-200 py-4 px-6 uppercase">{item.municipality}</TableCell>
                      <TableCell className="text-right font-medium text-slate-600 dark:text-slate-400 py-4 px-6">{item.target.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-bold text-violet-600 dark:text-violet-400 py-4 px-6">{item.attended.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-bold text-amber-600 dark:text-amber-500 py-4 px-6">{item.absent.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-bold text-blue-600 dark:text-blue-500 py-4 px-6">{item.remaining.toLocaleString()}</TableCell>
                      <TableCell className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold w-10 text-slate-700 dark:text-slate-300">{completion}%</span>
                          <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-500 ${
                                completion >= 100 ? 'bg-violet-500' : 
                                completion >= 75 ? 'bg-violet-400' : 
                                completion >= 50 ? 'bg-amber-400' : 
                                'bg-amber-500'
                              }`}
                              style={{ width: `${completion}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {/* Grand Total Row */}
                <TableRow className="bg-slate-50/80 dark:bg-slate-900/80 font-bold border-t-2 border-slate-200 dark:border-slate-700">
                  <TableCell className="py-4 px-6 uppercase text-violet-700 dark:text-violet-400">Grand Total</TableCell>
                  <TableCell className="text-right py-4 px-6">
                    {stats?.municipalityBreakdown?.reduce((sum, item) => sum + item.target, 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right py-4 px-6 text-violet-600 dark:text-violet-400">
                    {stats?.municipalityBreakdown?.reduce((sum, item) => sum + item.attended, 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right py-4 px-6 text-amber-600 dark:text-amber-500">
                    {stats?.municipalityBreakdown?.reduce((sum, item) => sum + item.absent, 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right py-4 px-6 text-blue-600 dark:text-blue-500">
                    {stats?.municipalityBreakdown?.reduce((sum, item) => sum + item.remaining, 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="py-4 px-6">
                    {(() => {
                      const totalTarget = stats?.municipalityBreakdown?.reduce((sum, item) => sum + item.target, 0) || 0;
                      const totalAttended = stats?.municipalityBreakdown?.reduce((sum, item) => sum + item.attended, 0) || 0;
                      const totalCompletion = totalTarget > 0 ? Math.round((totalAttended / totalTarget) * 100) : 0;
                      return (
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold w-10 text-violet-700 dark:text-violet-400">{totalCompletion}%</span>
                          <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-violet-600 transition-all duration-500" 
                              style={{ width: `${totalCompletion}%` }}
                            />
                          </div>
                        </div>
                      );
                    })()}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NesDashboardPage;
