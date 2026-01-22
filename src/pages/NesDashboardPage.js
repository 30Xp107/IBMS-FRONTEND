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
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Users, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle,
  TrendingUp,
  MapPin,
  Building2,
  Calendar,
  Filter,
  RefreshCw,
  Search,
  ArrowRight,
  FileText,
  PieChart as PieChartIcon,
  Info,
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from "lucide-react";
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

const YEARS = ["2024", "2025", "2026"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const NesDashboardPage = () => {
  const { api, user } = useAuth();
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [frmSchedules, setFrmSchedules] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [municipalityProvinceFilter, setMunicipalityProvinceFilter] = useState("all");
  const [sortConfigs, setSortConfigs] = useState({
    period: { key: 'period', direction: 'desc' },
    province: { key: 'province', direction: 'asc' },
    municipality: { key: 'municipality', direction: 'asc' }
  });

  useEffect(() => {
    fetchFrmSchedules();
  }, []);

  useEffect(() => {
    if (selectedPeriod) {
      fetchData();
    }
  }, [selectedPeriod]);

  const fetchFrmSchedules = async () => {
    try {
      const response = await api.get("/system-configs/frm_schedules");
      if (response.data && response.data.value) {
        const schedules = response.data.value;
        setFrmSchedules(schedules);
        
        // Find current period based on date
        const now = new Date();
        const current = schedules.find(s => {
          const start = new Date(s.startDate);
          const end = new Date(s.endDate);
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);
          return now >= start && now <= end;
        });

        if (current) {
          setSelectedPeriod(current.name);
        } else if (schedules.length > 0) {
          // Fallback to the latest period if none matches current date
          const sorted = [...schedules].sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());
          setSelectedPeriod(sorted[0].name);
        } else {
          // Final fallback to monthly if no custom schedules exist
          const fallback = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
          setSelectedPeriod(fallback);
        }
      } else {
        const now = new Date();
        setSelectedPeriod(`${MONTHS[now.getMonth()]} ${now.getFullYear()}`);
      }
    } catch (error) {
      console.error("Failed to fetch FRM schedules:", error);
      const now = new Date();
      setSelectedPeriod(`${MONTHS[now.getMonth()]} ${now.getFullYear()}`);
    }
  };

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
        aVal = a.target > 0 ? (a.attended / a.target) : 0;
        bVal = b.target > 0 ? (b.attended / b.target) : 0;
      } else {
        aVal = a[config.key];
        bVal = b[config.key];
      }
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        if (aVal !== bVal) {
          return config.direction === 'asc' ? aVal - bVal : bVal - aVal;
        }
      } else {
        aVal = String(aVal || '').toLowerCase();
        bVal = String(bVal || '').toLowerCase();
        
        if (aVal !== bVal) {
          if (aVal < bVal) return config.direction === 'asc' ? -1 : 1;
          if (aVal > bVal) return config.direction === 'asc' ? 1 : -1;
        }
      }
      
      // Secondary sort for stability (e.g., by name if primary values are equal)
      const secondaryKey = a.municipality ? 'municipality' : 'province';
      const aSec = String(a[secondaryKey] || '').toLowerCase();
      const bSec = String(b[secondaryKey] || '').toLowerCase();
      
      if (aSec < bSec) return -1;
      if (aSec > bSec) return 1;
      return 0;
    });
  };

  const SortIcon = ({ table, column }) => {
    const config = sortConfigs[table];
    if (config.key !== column) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" />;
    return config.direction === 'asc' 
      ? <ArrowUp className="w-3 h-3 ml-1 text-violet-600" /> 
      : <ArrowDown className="w-3 h-3 ml-1 text-violet-600" />;
  };

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const res = await api.get("/dashboard/nes-stats", {
        params: {
          period: selectedPeriod
        }
      });
      setStats(res.data);
    } catch (error) {
      toast.error("Failed to load NES dashboard data");
    } finally {
      setIsLoading(false);
    }
  };

  const attendanceData = (stats?.attendanceStats || [])
    .filter(item => item._id === "present" || item._id === "absent")
    .map(item => ({
      name: item._id === "present" ? "Present" : "Absent",
      value: item.count
    }));

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">NES Dashboard</h1>
          <p className="text-slate-500 dark:text-slate-400">
            Overview of Nutritional Education Sessions progress.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-1.5 rounded-md border border-slate-200 dark:border-slate-800 shadow-sm">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-full sm:w-48 h-8 text-[11px] font-medium border-none shadow-none focus:ring-0">
              <SelectValue placeholder="Select FRM Period" />
            </SelectTrigger>
            <SelectContent className="dark:bg-slate-900 dark:border-slate-800 max-h-[300px]">
              {frmSchedules && frmSchedules.length > 0 ? (
                frmSchedules.map((s) => (
                  <SelectItem key={s.name} value={s.name}>
                    {s.name}
                  </SelectItem>
                ))
              ) : selectedPeriod ? (
                <SelectItem value={selectedPeriod}>{selectedPeriod}</SelectItem>
              ) : null}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <Card className="md:col-span-1 relative overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 bg-white/50 dark:bg-slate-950/50 z-50 flex items-center justify-center backdrop-blur-[1px]">
            <div className="w-8 h-8 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
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

      <Card className="md:col-span-2 relative overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 bg-white/50 dark:bg-slate-950/50 z-50 flex items-center justify-center backdrop-blur-[1px]">
            <div className="w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
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
      <Card className="border-stone-200 dark:border-slate-800 shadow-sm overflow-hidden relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white/50 dark:bg-slate-950/50 z-50 flex items-center justify-center backdrop-blur-[1px]">
            <div className="w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        <CardHeader className="bg-slate-50/50 dark:bg-slate-800/30 border-b dark:border-slate-800">
          <CardTitle className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Clock className="w-5 h-5 text-violet-600" />
            FRM Period Monitoring
          </CardTitle>
          <CardDescription className="text-sm dark:text-slate-400 mt-1">
            Program performance across different periods
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0 min-h-[300px]">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                    <TableHead 
                      className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-xs py-4 px-6 cursor-pointer hover:bg-slate-100/50 transition-colors text-left pl-6"
                      onClick={() => handleSort('period', 'period')}
                    >
                      <div className="flex items-center justify-start">FRM Period <SortIcon table="period" column="period" /></div>
                    </TableHead>
                    <TableHead 
                      className="text-center font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-xs py-4 px-6 cursor-pointer hover:bg-slate-100/50 transition-colors hidden sm:table-cell"
                      onClick={() => handleSort('period', 'target')}
                    >
                      <div className="flex items-center justify-center">Target <SortIcon table="period" column="target" /></div>
                    </TableHead>
                    <TableHead 
                      className="text-center font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider text-xs py-4 px-6 cursor-pointer hover:bg-slate-100/50 transition-colors"
                      onClick={() => handleSort('period', 'attended')}
                    >
                      <div className="flex items-center justify-center">Attended <SortIcon table="period" column="attended" /></div>
                    </TableHead>
                    <TableHead 
                      className="text-center font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider text-xs py-4 px-6 cursor-pointer hover:bg-slate-100/50 transition-colors hidden lg:table-cell"
                      onClick={() => handleSort('period', 'absent')}
                    >
                      <div className="flex items-center justify-center">Absent <SortIcon table="period" column="absent" /></div>
                    </TableHead>
                    <TableHead 
                      className="text-center font-bold text-blue-600 dark:text-blue-500 uppercase tracking-wider text-xs py-4 px-6 cursor-pointer hover:bg-slate-100/50 transition-colors hidden xl:table-cell"
                      onClick={() => handleSort('period', 'remaining')}
                    >
                      <div className="flex items-center justify-center">Remaining <SortIcon table="period" column="remaining" /></div>
                    </TableHead>
                    <TableHead 
                      className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-xs py-4 px-6 w-[150px] cursor-pointer hover:bg-slate-100/50 transition-colors text-center hidden md:table-cell"
                      onClick={() => handleSort('period', 'completion')}
                    >
                      <div className="flex items-center justify-center">Completion <SortIcon table="period" column="completion" /></div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getSortedData(stats?.periodStats, sortConfigs.period)?.map((item, index) => {
                    const completion = item.target > 0 ? Math.round((item.attended / item.target) * 100) : 0;
                    return (
                      <TableRow key={index} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors border-b dark:border-slate-800">
                        <TableCell className="font-bold text-slate-800 dark:text-slate-200 py-4 px-6 text-left pl-6">{item.period}</TableCell>
                        <TableCell className="text-center font-medium text-slate-600 dark:text-slate-400 py-4 px-6 hidden sm:table-cell">{(item.target || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-center font-bold text-violet-600 dark:text-violet-400 py-4 px-6">{(item.attended || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-center font-bold text-amber-600 dark:text-amber-500 py-4 px-6 hidden lg:table-cell">{(item.absent || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-center font-bold text-blue-600 dark:text-blue-500 py-4 px-6 hidden xl:table-cell">{(item.remaining || 0).toLocaleString()}</TableCell>
                        <TableCell className="py-4 px-6 hidden md:table-cell">
                          <div className="flex items-center justify-center gap-3">
                            <span className="text-xs font-bold w-10 text-slate-700 dark:text-slate-300 text-center">{completion}%</span>
                            <div className="flex-1 max-w-[120px] h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
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
                    <TableCell className="py-4 px-6 uppercase text-violet-700 dark:text-violet-400 text-left pl-6">Grand Total</TableCell>
                    <TableCell className="text-center py-4 px-6 hidden sm:table-cell">
                      {stats?.periodStats?.reduce((sum, item) => sum + item.target, 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center py-4 px-6 text-violet-600 dark:text-violet-400">
                      {stats?.periodStats?.reduce((sum, item) => sum + item.attended, 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center py-4 px-6 text-amber-600 dark:text-amber-500 hidden lg:table-cell">
                      {stats?.periodStats?.reduce((sum, item) => sum + item.absent, 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center py-4 px-6 text-blue-600 dark:text-blue-500 hidden xl:table-cell">
                      {stats?.periodStats?.reduce((sum, item) => sum + item.remaining, 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="py-4 px-6 hidden md:table-cell">
                      {(() => {
                        const totalTarget = stats?.periodStats?.reduce((sum, item) => sum + item.target, 0) || 0;
                        const totalAttended = stats?.periodStats?.reduce((sum, item) => sum + item.attended, 0) || 0;
                        const totalCompletion = totalTarget > 0 ? Math.round((totalAttended / totalTarget) * 100) : 0;
                        return (
                          <div className="flex items-center justify-center gap-3">
                            <span className="text-xs font-bold w-10 text-violet-700 dark:text-violet-400 text-center">{totalCompletion}%</span>
                            <div className="flex-1 max-w-[120px] h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
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

        {/* Province Monitoring Table */}
        <Card className="border-stone-200 dark:border-slate-800 shadow-sm overflow-hidden relative">
          {isLoading && (
            <div className="absolute inset-0 bg-white/50 dark:bg-slate-950/50 z-50 flex items-center justify-center backdrop-blur-[1px]">
              <div className="w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          <CardHeader className="bg-slate-50/50 dark:bg-slate-800/30 border-b dark:border-slate-800">
            <div>
              <CardTitle className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-violet-600" />
                Province Monitoring
              </CardTitle>
              <CardDescription className="text-sm dark:text-slate-400 mt-1">
                NES progress per province
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/50 dark:bg-slate-900/50 hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                    <TableHead 
                      className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-xs py-4 px-6 cursor-pointer hover:bg-slate-100/50 transition-colors text-left pl-6"
                      onClick={() => handleSort('province', 'province')}
                    >
                      <div className="flex items-center justify-start">Province <SortIcon table="province" column="province" /></div>
                    </TableHead>
                    <TableHead 
                      className="text-center font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-xs py-4 px-6 cursor-pointer hover:bg-slate-100/50 transition-colors hidden sm:table-cell"
                      onClick={() => handleSort('province', 'target')}
                    >
                      <div className="flex items-center justify-center">Target <SortIcon table="province" column="target" /></div>
                    </TableHead>
                    <TableHead 
                      className="text-center font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider text-xs py-4 px-6 cursor-pointer hover:bg-slate-100/50 transition-colors"
                      onClick={() => handleSort('province', 'attended')}
                    >
                      <div className="flex items-center justify-center">Attended <SortIcon table="province" column="attended" /></div>
                    </TableHead>
                    <TableHead 
                      className="text-center font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider text-xs py-4 px-6 cursor-pointer hover:bg-slate-100/50 transition-colors hidden lg:table-cell"
                      onClick={() => handleSort('province', 'absent')}
                    >
                      <div className="flex items-center justify-center">Absent <SortIcon table="province" column="absent" /></div>
                    </TableHead>
                    <TableHead 
                      className="text-center font-bold text-blue-600 dark:text-blue-500 uppercase tracking-wider text-xs py-4 px-6 cursor-pointer hover:bg-slate-100/50 transition-colors hidden xl:table-cell"
                      onClick={() => handleSort('province', 'remaining')}
                    >
                      <div className="flex items-center justify-center">Remaining <SortIcon table="province" column="remaining" /></div>
                    </TableHead>
                    <TableHead 
                      className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-xs py-4 px-6 w-[150px] cursor-pointer hover:bg-slate-100/50 transition-colors text-center hidden md:table-cell"
                      onClick={() => handleSort('province', 'completion')}
                    >
                      <div className="flex items-center justify-center">Completion <SortIcon table="province" column="completion" /></div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getSortedData(stats?.provinceBreakdown, sortConfigs.province)?.map((item, index) => {
                    const completion = item.target > 0 ? Math.round((item.attended / item.target) * 100) : 0;
                    return (
                      <TableRow key={index} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors border-b dark:border-slate-800">
                        <TableCell className="font-bold text-slate-800 dark:text-slate-200 py-4 px-6 uppercase text-left pl-6">{item.province}</TableCell>
                        <TableCell className="text-center font-medium text-slate-600 dark:text-slate-400 py-4 px-6 hidden sm:table-cell">{(item.target || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-center font-bold text-violet-600 dark:text-violet-400 py-4 px-6">{(item.attended || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-center font-bold text-amber-600 dark:text-amber-500 py-4 px-6 hidden lg:table-cell">{(item.absent || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-center font-bold text-blue-600 dark:text-blue-500 py-4 px-6 hidden xl:table-cell">{(item.remaining || 0).toLocaleString()}</TableCell>
                        <TableCell className="py-4 px-6 hidden md:table-cell">
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-xs font-bold w-10 text-center">{completion}%</span>
                            <div className="flex-1 max-w-[100px] h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full bg-violet-500" style={{ width: `${completion}%` }} />
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="bg-slate-50/80 dark:bg-slate-900/80 font-bold border-t-2 border-slate-200 dark:border-slate-700">
                    <TableCell className="py-4 px-6 uppercase text-violet-700 dark:text-violet-400 text-left pl-6">Grand Total</TableCell>
                    <TableCell className="text-center py-4 px-6 hidden sm:table-cell">
                      {stats?.provinceBreakdown?.reduce((sum, item) => sum + item.target, 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center py-4 px-6 text-violet-600 dark:text-violet-400">
                      {stats?.provinceBreakdown?.reduce((sum, item) => sum + item.attended, 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center py-4 px-6 text-amber-600 dark:text-amber-500 hidden lg:table-cell">
                      {stats?.provinceBreakdown?.reduce((sum, item) => sum + item.absent, 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center py-4 px-6 text-blue-600 dark:text-blue-500 hidden xl:table-cell">
                      {stats?.provinceBreakdown?.reduce((sum, item) => sum + item.remaining, 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="py-4 px-6 hidden md:table-cell">
                      {(() => {
                        const totalTarget = stats?.provinceBreakdown?.reduce((sum, item) => sum + item.target, 0) || 0;
                        const totalAttended = stats?.provinceBreakdown?.reduce((sum, item) => sum + item.attended, 0) || 0;
                        const totalCompletion = totalTarget > 0 ? Math.round((totalAttended / totalTarget) * 100) : 0;
                        return (
                          <div className="flex items-center justify-center gap-2">
                            <span className="text-xs font-bold w-10 text-violet-700 dark:text-violet-400 text-center">{totalCompletion}%</span>
                            <div className="flex-1 max-w-[100px] h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                              <div className="h-full bg-violet-600" style={{ width: `${totalCompletion}%` }} />
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
      <Card className="border-stone-200 dark:border-slate-800 shadow-sm overflow-hidden relative">
        {isLoading && (
          <div className="absolute inset-0 bg-white/50 dark:bg-slate-950/50 z-50 flex items-center justify-center backdrop-blur-[1px]">
            <div className="w-10 h-10 border-4 border-violet-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        <CardHeader className="bg-slate-50/50 dark:bg-slate-800/30 border-b dark:border-slate-800">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-violet-600" />
                Municipality Monitoring
              </CardTitle>
              <CardDescription className="text-sm dark:text-slate-400 mt-1">
                NES progress per municipality for {selectedPeriod}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <Select value={municipalityProvinceFilter} onValueChange={setMunicipalityProvinceFilter}>
                <SelectTrigger className="w-[180px] h-9 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                  <SelectValue placeholder="Filter by Province" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Provinces</SelectItem>
                  {stats?.provinceBreakdown?.map(p => (
                    <SelectItem key={p.province} value={p.province}>{p.province}</SelectItem>
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
                    className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-xs py-4 px-6 cursor-pointer hover:bg-slate-100/50 transition-colors text-left pl-6"
                    onClick={() => handleSort('municipality', 'municipality')}
                  >
                    <div className="flex items-center justify-start">Municipality <SortIcon table="municipality" column="municipality" /></div>
                  </TableHead>
                  <TableHead 
                    className="text-center font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-xs py-4 px-6 cursor-pointer hover:bg-slate-100/50 transition-colors hidden sm:table-cell"
                    onClick={() => handleSort('municipality', 'target')}
                  >
                    <div className="flex items-center justify-center">Target <SortIcon table="municipality" column="target" /></div>
                  </TableHead>
                  <TableHead 
                    className="text-center font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider text-xs py-4 px-6 cursor-pointer hover:bg-slate-100/50 transition-colors"
                    onClick={() => handleSort('municipality', 'attended')}
                  >
                    <div className="flex items-center justify-center">Attended <SortIcon table="municipality" column="attended" /></div>
                  </TableHead>
                  <TableHead 
                    className="text-center font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider text-xs py-4 px-6 cursor-pointer hover:bg-slate-100/50 transition-colors hidden lg:table-cell"
                    onClick={() => handleSort('municipality', 'absent')}
                  >
                    <div className="flex items-center justify-center">Absent <SortIcon table="municipality" column="absent" /></div>
                  </TableHead>
                  <TableHead 
                    className="text-center font-bold text-blue-600 dark:text-blue-500 uppercase tracking-wider text-xs py-4 px-6 cursor-pointer hover:bg-slate-100/50 transition-colors hidden xl:table-cell"
                    onClick={() => handleSort('municipality', 'remaining')}
                  >
                    <div className="flex items-center justify-center">Remaining <SortIcon table="municipality" column="remaining" /></div>
                  </TableHead>
                  <TableHead 
                    className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-xs py-4 px-6 w-[200px] cursor-pointer hover:bg-slate-100/50 transition-colors text-center hidden md:table-cell"
                    onClick={() => handleSort('municipality', 'completion')}
                  >
                    <div className="flex items-center justify-center">Completion <SortIcon table="municipality" column="completion" /></div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {getSortedData(
                  municipalityProvinceFilter === "all" 
                    ? stats?.municipalityBreakdown 
                    : stats?.municipalityBreakdown?.filter(m => m.province === municipalityProvinceFilter), 
                  sortConfigs.municipality
                )?.map((item, index) => {
                  const completion = item.target > 0 ? Math.round((item.attended / item.target) * 100) : 0;
                  
                  return (
                    <TableRow key={index} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors border-b dark:border-slate-800">
                      <TableCell className="font-bold text-slate-800 dark:text-slate-200 py-4 px-6 uppercase text-left pl-6">{item.municipality}</TableCell>
                      <TableCell className="text-center font-medium text-slate-600 dark:text-slate-400 py-4 px-6 hidden sm:table-cell">{(item.target || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-center font-bold text-violet-600 dark:text-violet-400 py-4 px-6">{(item.attended || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-center font-bold text-amber-600 dark:text-amber-500 py-4 px-6 hidden lg:table-cell">{(item.absent || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-center font-bold text-blue-600 dark:text-blue-500 py-4 px-6 hidden xl:table-cell">{(item.remaining || 0).toLocaleString()}</TableCell>
                      <TableCell className="py-4 px-6 hidden md:table-cell">
                        <div className="flex items-center justify-center gap-3">
                          <span className="text-xs font-bold w-10 text-slate-700 dark:text-slate-300 text-center">{completion}%</span>
                          <div className="flex-1 max-w-[120px] h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
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
                <TableRow className="bg-slate-50/80 dark:bg-slate-900/80 font-bold border-t-2 border-slate-200 dark:border-slate-700">
                  <TableCell className="py-4 px-6 uppercase text-violet-700 dark:text-violet-400 text-left pl-6">Grand Total</TableCell>
                  <TableCell className="text-center py-4 px-6 hidden sm:table-cell">
                    {(municipalityProvinceFilter === "all" 
                      ? stats?.municipalityBreakdown 
                      : stats?.municipalityBreakdown?.filter(m => m.province === municipalityProvinceFilter)
                    )?.reduce((sum, item) => sum + item.target, 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-center py-4 px-6 text-violet-600 dark:text-violet-400">
                    {(municipalityProvinceFilter === "all" 
                      ? stats?.municipalityBreakdown 
                      : stats?.municipalityBreakdown?.filter(m => m.province === municipalityProvinceFilter)
                    )?.reduce((sum, item) => sum + item.attended, 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-center py-4 px-6 text-amber-600 dark:text-amber-500 hidden lg:table-cell">
                    {(municipalityProvinceFilter === "all" 
                      ? stats?.municipalityBreakdown 
                      : stats?.municipalityBreakdown?.filter(m => m.province === municipalityProvinceFilter)
                    )?.reduce((sum, item) => sum + item.absent, 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-center py-4 px-6 text-blue-600 dark:text-blue-500 hidden xl:table-cell">
                    {(municipalityProvinceFilter === "all" 
                      ? stats?.municipalityBreakdown 
                      : stats?.municipalityBreakdown?.filter(m => m.province === municipalityProvinceFilter)
                    )?.reduce((sum, item) => sum + item.remaining, 0).toLocaleString()}
                  </TableCell>
                  <TableCell className="py-4 px-6 hidden md:table-cell">
                    {(() => {
                      const filteredData = municipalityProvinceFilter === "all" 
                        ? stats?.municipalityBreakdown 
                        : stats?.municipalityBreakdown?.filter(m => m.province === municipalityProvinceFilter);
                      const totalTarget = filteredData?.reduce((sum, item) => sum + item.target, 0) || 0;
                      const totalAttended = filteredData?.reduce((sum, item) => sum + item.attended, 0) || 0;
                      const totalCompletion = totalTarget > 0 ? Math.round((totalAttended / totalTarget) * 100) : 0;
                      return (
                        <div className="flex items-center justify-center gap-3">
                          <span className="text-xs font-bold w-10 text-violet-700 dark:text-violet-400 text-center">{totalCompletion}%</span>
                          <div className="flex-1 max-w-[120px] h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
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
    </div>
  );
};

export default NesDashboardPage;
