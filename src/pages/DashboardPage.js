import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, Calendar, FileText, UserCheck, TrendingUp, AlertCircle, Clock, ArrowRight, Activity, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { formatDistanceToNow, isValid } from "date-fns";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const DashboardPage = () => {
  const { api, isAdmin, user } = useAuth();
  const [stats, setStats] = useState(null);
  const [recentLogs, setRecentLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const statsRes = await api.get("/dashboard/stats");
      setStats(statsRes.data);

      // Only fetch audit logs if user is admin
      if (isAdmin) {
        try {
          const logsRes = await api.get("/audit-logs?limit=5");
          setRecentLogs(logsRes.data);
        } catch (logError) {
          console.error("Failed to load audit logs:", logError);
          // Don't show toast error for logs if the main stats loaded
        }
      }
    } catch (error) {
      toast.error("Failed to load dashboard data");
    } finally {
      setIsLoading(false);
    }
  };

  const getActionColor = (action) => {
    switch (action) {
      case "CREATE": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
      case "UPDATE": return "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400";
      case "DELETE": return "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400";
      default: return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="spinner" />
      </div>
    );
  }

  const statCards = [
    {
      title: "Total Beneficiaries",
      value: stats?.total_beneficiaries || 0,
      icon: Users,
      color: "text-emerald-600",
      bgColor: "bg-emerald-100",
    },
    {
      title: "Total Redemptions",
      value: stats?.total_redemptions || 0,
      icon: Calendar,
      color: "text-sky-600",
      bgColor: "bg-sky-100",
    },
    {
      title: "Total NES Records",
      value: stats?.total_nes || 0,
      icon: FileText,
      color: "text-violet-600",
      bgColor: "bg-violet-100",
    },
    ...(isAdmin
      ? [
          {
            title: "Pending Users",
            value: stats?.pending_users || 0,
            icon: UserCheck,
            color: "text-amber-600",
            bgColor: "bg-amber-100",
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Dashboard</h1>
        <p className="text-slate-500 dark:text-slate-400">
          Welcome back, {user?.name}! Here's your program overview.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((card, index) => (
          <Card
            key={card.title}
            className="border-stone-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md"
          >
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400">{card.title}</p>
                  <p className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 mt-1">{card.value}</p>
                </div>
                <div className={`w-10 h-10 sm:w-12 sm:h-12 ${card.bgColor} dark:bg-slate-800/80 rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <card.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${card.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Stats & Trends */}
        <Card className="lg:col-span-2 border-stone-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <CardHeader className="bg-slate-50/50 dark:bg-slate-800/30 border-b dark:border-slate-800 p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-500" />
                  Program Trends
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm dark:text-slate-400 mt-0.5 sm:mt-1">
                  Comprehensive history of redemption and NES activity
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            {/* Chart Section */}
            <div className="h-[250px] sm:h-[300px] w-full mb-8">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats?.monthly_trends || []}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: "#64748b" }}
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: "#64748b" }}
                  />
                  <RechartsTooltip 
                    cursor={{ fill: '#f1f5f9' }}
                    contentStyle={{ 
                      borderRadius: '8px', 
                      border: 'none', 
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      fontSize: '12px'
                    }}
                  />
                  <Legend 
                    verticalAlign="top" 
                    align="right" 
                    iconType="circle"
                    wrapperStyle={{ paddingBottom: '20px', fontSize: '12px' }}
                  />
                  <Bar 
                    name="Redemptions" 
                    dataKey="redemptions" 
                    fill="#10b981" 
                    radius={[4, 4, 0, 0]} 
                    barSize={20}
                  />
                  <Bar 
                    name="NES Records" 
                    dataKey="nes" 
                    fill="#8b5cf6" 
                    radius={[4, 4, 0, 0]} 
                    barSize={20}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <Separator className="mb-6 dark:bg-slate-800" />

            {/* All Months Data Grid */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-4">
                <Calendar className="w-4 h-4 text-slate-500" />
                Monthly Breakdown
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {(stats?.monthly_trends || []).slice().reverse().map((monthData) => (
                  <div 
                    key={monthData.fullName}
                    className="p-4 rounded-xl border border-stone-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30 hover:bg-white dark:hover:bg-slate-800/50 transition-all group"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {monthData.fullName}
                      </p>
                      {monthData.fullName === stats?.current_month && (
                        <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-none text-[10px] px-2 py-0">
                          Current
                        </Badge>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-medium">Redemptions</p>
                        <p className="text-lg font-bold text-slate-800 dark:text-slate-200">{monthData.redemptions}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-medium">NES Records</p>
                        <p className="text-lg font-bold text-slate-800 dark:text-slate-200">{monthData.nes}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Info & Activity */}
        <div className="space-y-4 sm:space-y-6">
          <Card className="border-stone-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <CardHeader className="p-4 pb-3 dark:border-slate-800 border-b bg-slate-50/50 dark:bg-slate-800/30">
              <CardTitle className="text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                Quick Info
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="flex items-center gap-3 p-3 bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                  <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-500" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">Role</p>
                  <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-400 capitalize">{user?.role}</p>
                </div>
              </div>

              {user?.assigned_areas && user.assigned_areas.length > 0 && (
                <div className="p-3 bg-sky-50/50 dark:bg-sky-900/10 border border-sky-100 dark:border-sky-900/20 rounded-lg">
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider mb-2">Assigned Areas</p>
                  <div className="flex flex-wrap gap-1.5">
                    {user.assigned_areas.map((area) => (
                      <Badge
                        key={area}
                        variant="secondary"
                        className="bg-sky-100/50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/50 border-none text-[10px]"
                      >
                        {area}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {isAdmin && stats?.pending_users > 0 && (
                <Link to="/users">
                  <div className="mt-1 p-3 bg-amber-50/50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 rounded-lg flex items-center justify-between group hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors">
                    <div className="min-w-0">
                      <p className="text-xs text-amber-800 dark:text-amber-400 font-semibold truncate">Pending Approvals</p>
                      <p className="text-[11px] text-amber-700 dark:text-amber-500/80 truncate">{stats.pending_users} waiting for action</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-amber-600 flex-shrink-0 transition-transform group-hover:translate-x-1" />
                  </div>
                </Link>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity Mini-Feed - Only for Admins */}
          {isAdmin && (
            <Card className="border-stone-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <CardHeader className="p-4 pb-3 dark:border-slate-800 border-b bg-slate-50/50 dark:bg-slate-800/30">
                <CardTitle className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-violet-500" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="h-[180px] sm:h-[200px]">
                  <div className="divide-y dark:divide-slate-800">
                    {recentLogs.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-500 dark:text-slate-400">
                        No recent activity
                      </div>
                    ) : (
                      recentLogs.map((log) => (
                        <div key={log._id} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                          <div className="flex items-start gap-2 sm:gap-3">
                            <div className={`mt-1.5 w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full flex-shrink-0 ${
                              log.action === "CREATE" ? "bg-emerald-500" :
                              log.action === "DELETE" ? "bg-rose-500" : "bg-sky-500"
                            }`} />
                            <div className="space-y-1 min-w-0">
                              <p className="text-[10px] sm:text-[11px] leading-tight text-slate-700 dark:text-slate-300">
                                <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">{log.user_name}</span>
                                {" "}{log.action.toLowerCase()}d a record in{" "}
                                <span className="font-medium text-slate-900 dark:text-slate-100">{log.module}</span>
                              </p>
                              <div className="flex items-center gap-1 text-[9px] sm:text-[10px] text-slate-400 dark:text-slate-500">
                                <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                {(() => {
                                  const ts = log.timestamp || log.createdAt;
                                  return ts && isValid(new Date(ts)) 
                                    ? formatDistanceToNow(new Date(ts), { addSuffix: true })
                                    : "just now";
                                })()}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
                {recentLogs.length > 0 && (
                  <div className="p-2 border-t dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
                    <Link to="/audit-log" className="text-[10px] font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200 flex items-center justify-center gap-1">
                      View full audit trail
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
