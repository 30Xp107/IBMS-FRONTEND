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
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Calendar, PieChart as PieChartIcon, TrendingUp, Info, MapPin, Clock, Filter, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
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

const COLORS = ["#10b981", "#f43f5e", "#6366f1", "#f59e0b"];

const YEARS = ["2024", "2025", "2026"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const RedemptionDashboardPage = () => {
  const { api, user } = useAuth();
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState(new Date().toLocaleString("default", { month: "long" }));
  const [sortConfigs, setSortConfigs] = useState({
    period: { key: 'period', direction: 'desc' },
    province: { key: 'province', direction: 'asc' },
    municipality: { key: 'municipality', direction: 'asc' }
  });

  useEffect(() => {
    fetchData();
  }, [selectedYear, selectedMonth]);

  const handleSort = (table, key) => {
    setSortConfigs(prev => ({
      ...prev,
      [table]: {
        key,
        direction: prev[table].key === key && prev[table].direction === 'asc' ? 'desc' : 'asc'
      }
    }));
  };

  const getSortedData = (data, config) => {
    if (!data || !config) return data;
    return [...data].sort((a, b) => {
      let aVal, bVal;
      
      if (config.key === 'completion') {
        aVal = a.target > 0 ? (a.redeemed / a.target) : 0;
        bVal = b.target > 0 ? (b.redeemed / b.target) : 0;
      } else {
        aVal = a[config.key];
        bVal = b[config.key];
      }
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return config.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      aVal = String(aVal || '').toLowerCase();
      bVal = String(bVal || '').toLowerCase();
      
      if (aVal < bVal) return config.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return config.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const SortIcon = ({ table, column }) => {
    const config = sortConfigs[table];
    if (config.key !== column) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" />;
    return config.direction === 'asc' 
      ? <ArrowUp className="w-3 h-3 ml-1 text-emerald-600" /> 
      : <ArrowDown className="w-3 h-3 ml-1 text-emerald-600" />;
  };

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const res = await api.get("/dashboard/redemption-stats", {
        params: {
          year: selectedYear,
          month: selectedMonth
        }
      });
      setStats(res.data);
    } catch (error) {
      toast.error("Failed to load redemption dashboard data");
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
    redeemed: item.redeemed,
    target: item.target
  })).reverse() || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Redemption Dashboard</h1>
        <p className="text-slate-500 dark:text-slate-400">
          Detailed overview of Walang Gutom Program redemptions.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-emerald-600" />
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
              <TrendingUp className="w-5 h-5 text-emerald-600" />
              Redemption Trends
            </CardTitle>
            <CardDescription>Target vs Validated redemptions over the last 12 periods</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="period" />
                <YAxis />
                <RechartsTooltip />
                <Legend />
                <Bar name="Redeemed" dataKey="redeemed" fill="#10b981" radius={[4, 4, 0, 0]} />
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
              <Clock className="w-5 h-5 text-emerald-600" />
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
                    <TableHead 
                      className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-xs py-4 px-6 cursor-pointer hover:bg-slate-100/50 transition-colors"
                      onClick={() => handleSort('period', 'period')}
                    >
                      <div className="flex items-center">FRM Period <SortIcon table="period" column="period" /></div>
                    </TableHead>
                    <TableHead 
                      className="text-right font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-xs py-4 px-6 cursor-pointer hover:bg-slate-100/50 transition-colors"
                      onClick={() => handleSort('period', 'target')}
                    >
                      <div className="flex items-center justify-end">Target <SortIcon table="period" column="target" /></div>
                    </TableHead>
                    <TableHead 
                      className="text-right font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider text-xs py-4 px-6 cursor-pointer hover:bg-slate-100/50 transition-colors"
                      onClick={() => handleSort('period', 'redeemed')}
                    >
                      <div className="flex items-center justify-end">Redeemed <SortIcon table="period" column="redeemed" /></div>
                    </TableHead>
                    <TableHead 
                      className="text-right font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider text-xs py-4 px-6 cursor-pointer hover:bg-slate-100/50 transition-colors"
                      onClick={() => handleSort('period', 'unredeemed')}
                    >
                      <div className="flex items-center justify-end">UnRedeemed <SortIcon table="period" column="unredeemed" /></div>
                    </TableHead>
                    <TableHead 
                      className="text-right font-bold text-blue-600 dark:text-blue-500 uppercase tracking-wider text-xs py-4 px-6 cursor-pointer hover:bg-slate-100/50 transition-colors"
                      onClick={() => handleSort('period', 'remaining')}
                    >
                      <div className="flex items-center justify-end">Remaining <SortIcon table="period" column="remaining" /></div>
                    </TableHead>
                    <TableHead 
                      className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-xs py-4 px-6 w-[150px] cursor-pointer hover:bg-slate-100/50 transition-colors"
                      onClick={() => handleSort('period', 'completion')}
                    >
                      <div className="flex items-center">Completion <SortIcon table="period" column="completion" /></div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getSortedData(stats?.periodStats, sortConfigs.period)?.map((item, index) => {
                    const completion = item.target > 0 ? Math.round((item.redeemed / item.target) * 100) : 0;
                    return (
                      <TableRow key={index} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors border-b dark:border-slate-800">
                        <TableCell className="font-bold text-slate-800 dark:text-slate-200 py-4 px-6">{item.period}</TableCell>
                        <TableCell className="text-right font-medium text-slate-600 dark:text-slate-400 py-4 px-6">{item.target.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400 py-4 px-6">{item.redeemed.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-bold text-amber-600 dark:text-amber-500 py-4 px-6">{item.unredeemed.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-bold text-blue-600 dark:text-blue-500 py-4 px-6">{item.remaining.toLocaleString()}</TableCell>
                        <TableCell className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold w-10">{completion}%</span>
                            <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500" style={{ width: `${completion}%` }} />
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {/* Grand Total Row */}
                  <TableRow className="bg-slate-50/80 dark:bg-slate-900/80 font-bold border-t-2 border-slate-200 dark:border-slate-700">
                    <TableCell className="py-4 px-6 uppercase text-emerald-700 dark:text-emerald-400">Grand Total</TableCell>
                    <TableCell className="text-right py-4 px-6">
                      {stats?.periodStats?.reduce((sum, item) => sum + item.target, 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right py-4 px-6 text-emerald-600 dark:text-emerald-400">
                      {stats?.periodStats?.reduce((sum, item) => sum + item.redeemed, 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right py-4 px-6 text-amber-600 dark:text-amber-500">
                      {stats?.periodStats?.reduce((sum, item) => sum + item.unredeemed, 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right py-4 px-6 text-blue-600 dark:text-blue-500">
                      {stats?.periodStats?.reduce((sum, item) => sum + item.remaining, 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="py-4 px-6">
                      {(() => {
                        const totalTarget = stats?.periodStats?.reduce((sum, item) => sum + item.target, 0) || 0;
                        const totalRedeemed = stats?.periodStats?.reduce((sum, item) => sum + item.redeemed, 0) || 0;
                        const totalCompletion = totalTarget > 0 ? Math.round((totalRedeemed / totalTarget) * 100) : 0;
                        return (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold w-10 text-emerald-700 dark:text-emerald-400">{totalCompletion}%</span>
                            <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-600" style={{ width: `${totalCompletion}%` }} />
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

        {/* Province Monitoring Table */}
        <Card className="border-stone-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50/50 dark:bg-slate-800/30 border-b dark:border-slate-800">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-emerald-600" />
                  Province Monitoring
                </CardTitle>
                <CardDescription className="text-sm dark:text-slate-400 mt-1">
                  Redemption progress per province for {selectedMonth} {selectedYear}
                </CardDescription>
              </div>

              <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-md border border-slate-200 dark:border-slate-800 shadow-sm">
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-[100px] h-8 text-[11px] font-medium border-none shadow-none focus:ring-0">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map(year => (
                      <SelectItem key={year} value={year}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="w-px h-4 bg-slate-200 dark:bg-slate-800" />
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-[120px] h-8 text-[11px] font-medium border-none shadow-none focus:ring-0">
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map(month => (
                      <SelectItem key={month} value={month}>{month}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                    <TableHead 
                      className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-xs py-4 px-6 cursor-pointer hover:bg-slate-100/50 transition-colors"
                      onClick={() => handleSort('province', 'province')}
                    >
                      <div className="flex items-center">Province <SortIcon table="province" column="province" /></div>
                    </TableHead>
                    <TableHead 
                      className="text-right font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-xs py-4 px-6 cursor-pointer hover:bg-slate-100/50 transition-colors"
                      onClick={() => handleSort('province', 'target')}
                    >
                      <div className="flex items-center justify-end">Target <SortIcon table="province" column="target" /></div>
                    </TableHead>
                    <TableHead 
                      className="text-right font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider text-xs py-4 px-6 cursor-pointer hover:bg-slate-100/50 transition-colors"
                      onClick={() => handleSort('province', 'redeemed')}
                    >
                      <div className="flex items-center justify-end">Redeemed <SortIcon table="province" column="redeemed" /></div>
                    </TableHead>
                    <TableHead 
                      className="text-right font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider text-xs py-4 px-6 cursor-pointer hover:bg-slate-100/50 transition-colors"
                      onClick={() => handleSort('province', 'unredeemed')}
                    >
                      <div className="flex items-center justify-end">UnRedeemed <SortIcon table="province" column="unredeemed" /></div>
                    </TableHead>
                    <TableHead 
                      className="text-right font-bold text-blue-600 dark:text-blue-500 uppercase tracking-wider text-xs py-4 px-6 cursor-pointer hover:bg-slate-100/50 transition-colors"
                      onClick={() => handleSort('province', 'remaining')}
                    >
                      <div className="flex items-center justify-end">Remaining <SortIcon table="province" column="remaining" /></div>
                    </TableHead>
                    <TableHead 
                      className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-xs py-4 px-6 w-[150px] cursor-pointer hover:bg-slate-100/50 transition-colors"
                      onClick={() => handleSort('province', 'completion')}
                    >
                      <div className="flex items-center">Completion <SortIcon table="province" column="completion" /></div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getSortedData(stats?.provinceBreakdown, sortConfigs.province)?.map((item, index) => {
                    const completion = item.target > 0 ? Math.round((item.redeemed / item.target) * 100) : 0;
                    return (
                      <TableRow key={index} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors border-b dark:border-slate-800">
                        <TableCell className="font-bold text-slate-800 dark:text-slate-200 py-4 px-6 uppercase">{item.province}</TableCell>
                        <TableCell className="text-right font-medium text-slate-600 dark:text-slate-400 py-4 px-6">{item.target.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400 py-4 px-6">{item.redeemed.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-bold text-amber-600 dark:text-amber-500 py-4 px-6">{item.unredeemed.toLocaleString()}</TableCell>
                        <TableCell className="text-right font-bold text-blue-600 dark:text-blue-500 py-4 px-6">{item.remaining.toLocaleString()}</TableCell>
                        <TableCell className="py-4 px-6">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold w-10">{completion}%</span>
                            <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500" style={{ width: `${completion}%` }} />
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {/* Grand Total Row */}
                  <TableRow className="bg-slate-50/80 dark:bg-slate-900/80 font-bold border-t-2 border-slate-200 dark:border-slate-700">
                    <TableCell className="py-4 px-6 uppercase text-emerald-700 dark:text-emerald-400">Grand Total</TableCell>
                    <TableCell className="text-right py-4 px-6">
                      {stats?.provinceBreakdown?.reduce((sum, item) => sum + item.target, 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right py-4 px-6 text-emerald-600 dark:text-emerald-400">
                      {stats?.provinceBreakdown?.reduce((sum, item) => sum + item.redeemed, 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right py-4 px-6 text-amber-600 dark:text-amber-500">
                      {stats?.provinceBreakdown?.reduce((sum, item) => sum + item.unredeemed, 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right py-4 px-6 text-blue-600 dark:text-blue-500">
                      {stats?.provinceBreakdown?.reduce((sum, item) => sum + item.remaining, 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="py-4 px-6">
                      {(() => {
                        const totalTarget = stats?.provinceBreakdown?.reduce((sum, item) => sum + item.target, 0) || 0;
                        const totalRedeemed = stats?.provinceBreakdown?.reduce((sum, item) => sum + item.redeemed, 0) || 0;
                        const totalCompletion = totalTarget > 0 ? Math.round((totalRedeemed / totalTarget) * 100) : 0;
                        return (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold w-10 text-emerald-700 dark:text-emerald-400">{totalCompletion}%</span>
                            <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-600" style={{ width: `${totalCompletion}%` }} />
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

      {/* Municipality Breakdown Table */}
      <Card className="border-stone-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/50 dark:bg-slate-800/30 border-b dark:border-slate-800">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-600" />
                Municipality Monitoring
              </CardTitle>
              <CardDescription className="text-sm dark:text-slate-400 mt-1">
                Redemption progress per municipality for {selectedMonth} {selectedYear}
              </CardDescription>
            </div>

            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-md border border-slate-200 dark:border-slate-800 shadow-sm">
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[100px] h-8 text-[11px] font-medium border-none shadow-none focus:ring-0">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {YEARS.map(year => (
                    <SelectItem key={year} value={year}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="w-px h-4 bg-slate-200 dark:bg-slate-800" />
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[120px] h-8 text-[11px] font-medium border-none shadow-none focus:ring-0">
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map(month => (
                    <SelectItem key={month} value={month}>{month}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                  <TableHead 
                    className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-xs py-4 px-6 cursor-pointer hover:bg-slate-100/50 transition-colors"
                    onClick={() => handleSort('municipality', 'municipality')}
                  >
                    <div className="flex items-center">Municipality <SortIcon table="municipality" column="municipality" /></div>
                  </TableHead>
                  <TableHead 
                    className="text-right font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-xs py-4 px-6 cursor-pointer hover:bg-slate-100/50 transition-colors"
                    onClick={() => handleSort('municipality', 'target')}
                  >
                    <div className="flex items-center justify-end">Target <SortIcon table="municipality" column="target" /></div>
                  </TableHead>
                  <TableHead 
                    className="text-right font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider text-xs py-4 px-6 cursor-pointer hover:bg-slate-100/50 transition-colors"
                    onClick={() => handleSort('municipality', 'redeemed')}
                  >
                    <div className="flex items-center justify-end">Redeemed <SortIcon table="municipality" column="redeemed" /></div>
                  </TableHead>
                  <TableHead 
                    className="text-right font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider text-xs py-4 px-6 cursor-pointer hover:bg-slate-100/50 transition-colors"
                    onClick={() => handleSort('municipality', 'unredeemed')}
                  >
                    <div className="flex items-center justify-end">UnRedeemed <SortIcon table="municipality" column="unredeemed" /></div>
                  </TableHead>
                  <TableHead 
                    className="text-right font-bold text-blue-600 dark:text-blue-500 uppercase tracking-wider text-xs py-4 px-6 cursor-pointer hover:bg-slate-100/50 transition-colors"
                    onClick={() => handleSort('municipality', 'remaining')}
                  >
                    <div className="flex items-center justify-end">Remaining <SortIcon table="municipality" column="remaining" /></div>
                  </TableHead>
                  <TableHead 
                    className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-xs py-4 px-6 w-[200px] cursor-pointer hover:bg-slate-100/50 transition-colors"
                    onClick={() => handleSort('municipality', 'completion')}
                  >
                    <div className="flex items-center">Completion <SortIcon table="municipality" column="completion" /></div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {getSortedData(stats?.municipalityBreakdown, sortConfigs.municipality)?.map((item, index) => {
                  const completion = item.target > 0 ? Math.round((item.redeemed / item.target) * 100) : 0;
                  return (
                    <TableRow key={index} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors border-b dark:border-slate-800">
                      <TableCell className="font-bold text-slate-800 dark:text-slate-200 py-4 px-6 uppercase">{item.municipality}</TableCell>
                      <TableCell className="text-right font-medium text-slate-600 dark:text-slate-400 py-4 px-6">{item.target.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-bold text-emerald-600 dark:text-emerald-400 py-4 px-6">{item.redeemed.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-bold text-amber-600 dark:text-amber-500 py-4 px-6">{item.unredeemed.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-bold text-blue-600 dark:text-blue-500 py-4 px-6">{item.remaining.toLocaleString()}</TableCell>
                      <TableCell className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold w-10 text-slate-700 dark:text-slate-300">{completion}%</span>
                          <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className={`h-full transition-all duration-500 ${
                                completion >= 100 ? 'bg-emerald-500' : 
                                completion >= 75 ? 'bg-emerald-400' : 
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
                  <TableCell className="py-4 px-6 uppercase text-emerald-700 dark:text-emerald-400">Grand Total</TableCell>
                  <TableCell className="text-right py-4 px-6">
                    {stats?.municipalityBreakdown?.reduce((sum, item) => sum + item.target, 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right py-4 px-6 text-emerald-600 dark:text-emerald-400">
                    {stats?.municipalityBreakdown?.reduce((sum, item) => sum + item.redeemed, 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right py-4 px-6 text-amber-600 dark:text-amber-500">
                    {stats?.municipalityBreakdown?.reduce((sum, item) => sum + item.unredeemed, 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right py-4 px-6 text-blue-600 dark:text-blue-500">
                    {stats?.municipalityBreakdown?.reduce((sum, item) => sum + item.remaining, 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="py-4 px-6">
                    {(() => {
                      const totalTarget = stats?.municipalityBreakdown?.reduce((sum, item) => sum + item.target, 0) || 0;
                      const totalRedeemed = stats?.municipalityBreakdown?.reduce((sum, item) => sum + item.redeemed, 0) || 0;
                      const totalCompletion = totalTarget > 0 ? Math.round((totalRedeemed / totalTarget) * 100) : 0;
                      return (
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold w-10 text-emerald-700 dark:text-emerald-400">{totalCompletion}%</span>
                          <div className="flex-1 h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-emerald-600 transition-all duration-500" 
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

export default RedemptionDashboardPage;
