import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, Calendar as CalendarIcon, FileText, UserCheck, TrendingUp, AlertCircle, Clock, ArrowRight, Activity, ChevronRight, Plus, Trash2, CheckCircle2, Circle, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, formatDistanceToNow, isValid, isSameDay } from "date-fns";
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
  
  // Calendar States
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [isSubmittingEvent, setIsSubmittingEvent] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventFormData, setEventFormData] = useState({
    title: "",
    description: "",
    type: "event",
    start: new Date(),
    allDay: false,
    color: "#10b981"
  });

  useEffect(() => {
    fetchData();
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const res = await api.get("/calendar-events");
      setEvents(res.data.events || []);
    } catch (error) {
      console.error("Failed to fetch events:", error);
    }
  };

  const handleSubmitEvent = async (e) => {
    e.preventDefault();
    try {
      setIsSubmittingEvent(true);
      if (editingEvent) {
        const res = await api.put(`/calendar-events/${editingEvent._id}`, {
          ...eventFormData,
          start: selectedDate
        });
        setEvents(events.map(ev => ev._id === editingEvent._id ? res.data.event : ev));
        toast.success("Event updated successfully");
      } else {
        const res = await api.post("/calendar-events", {
          ...eventFormData,
          start: selectedDate
        });
        setEvents([...events, res.data.event]);
        toast.success("Event created successfully");
      }
      setIsEventDialogOpen(false);
      resetEventForm();
    } catch (error) {
      toast.error(editingEvent ? "Failed to update event" : "Failed to create event");
    } finally {
      setIsSubmittingEvent(false);
    }
  };

  const handleEditClick = (event) => {
    setEditingEvent(event);
    setEventFormData({
      title: event.title,
      description: event.description || "",
      type: event.type,
      start: new Date(event.start),
      allDay: event.allDay,
      color: event.color
    });
    setSelectedDate(new Date(event.start));
    setIsEventDialogOpen(true);
  };

  const handleUpdateEvent = async (id, updates) => {
    try {
      const res = await api.put(`/calendar-events/${id}`, updates);
      setEvents(events.map(e => e._id === id ? res.data.event : e));
      if (!updates.status) toast.success("Event updated successfully");
    } catch (error) {
      toast.error("Failed to update event");
    }
  };

  const handleDeleteEvent = async (id) => {
    if (!window.confirm("Are you sure you want to delete this event?")) return;
    try {
      await api.delete(`/calendar-events/${id}`);
      setEvents(events.filter(e => e._id !== id));
      toast.success("Event deleted successfully");
    } catch (error) {
      toast.error("Failed to delete event");
    }
  };

  const resetEventForm = () => {
    setEventFormData({
      title: "",
      description: "",
      type: "event",
      start: new Date(),
      allDay: false,
      color: "#10b981"
    });
    setEditingEvent(null);
  };

  const selectedDayEvents = events.filter(event => 
    isSameDay(new Date(event.start), selectedDate)
  );

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const statsRes = await api.get("/dashboard/stats");
      setStats(statsRes.data);

      // Only fetch audit logs if user is admin
      if (isAdmin) {
        try {
          const logsRes = await api.get("/audit-logs?limit=5");
          setRecentLogs(logsRes.data.logs || []);
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

  if (isLoading && !stats) {
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
      link: "/beneficiaries"
    },
    {
      title: "Total Redemptions",
      value: stats?.total_redemptions || 0,
      icon: Calendar,
      color: "text-sky-600",
      bgColor: "bg-sky-100",
      link: "/dashboard/redemption"
    },
    {
      title: "Total NES Records",
      value: stats?.total_nes || 0,
      icon: FileText,
      color: "text-violet-600",
      bgColor: "bg-violet-100",
      link: "/dashboard/nes"
    },
    ...(isAdmin
      ? [
          {
            title: "Pending Users",
            value: stats?.pending_users || 0,
            icon: UserCheck,
            color: "text-amber-600",
            bgColor: "bg-amber-100",
            link: "/users"
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
          <Link key={card.title} to={card.link}>
            <Card
              className="border-stone-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md cursor-pointer hover:border-emerald-200 dark:hover:border-emerald-800 group"
            >
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 group-hover:text-emerald-600 transition-colors">{card.title}</p>
                    <p className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 mt-1">{card.value}</p>
                  </div>
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 ${card.bgColor} dark:bg-slate-800/80 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                    <card.icon className={`w-5 h-5 sm:w-6 sm:h-6 ${card.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
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

        {/* Calendar Section */}
        <Card className="lg:col-span-2 border-stone-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <CardHeader className="p-4 sm:p-6 pb-3 dark:border-slate-800 border-b bg-slate-50/50 dark:bg-slate-800/30">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-500" />
                  Task & Event Calendar
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm dark:text-slate-400 mt-0.5">
                  Manage your daily tasks and system events
                </CardDescription>
              </div>
              <Button 
                onClick={() => setIsEventDialogOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 h-9 text-xs sm:text-sm"
              >
                <Plus className="w-4 h-4" />
                Add Event
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x dark:divide-slate-800">
              {/* Calendar Sidebar */}
              <div className="md:col-span-5 lg:col-span-4 p-4 flex flex-col items-center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  className="rounded-md border-none"
                  modifiers={{
                    hasEvent: (date) => events.some(event => isSameDay(new Date(event.start), date))
                  }}
                  modifiersStyles={{
                    hasEvent: { 
                      fontWeight: 'bold',
                      textDecoration: 'underline',
                      color: '#4f46e5'
                    }
                  }}
                />
              </div>

              {/* Events List */}
              <div className="md:col-span-7 lg:col-span-8 flex flex-col h-[400px]">
                <div className="p-4 border-b dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    {format(selectedDate, "MMMM d, yyyy")}
                  </h3>
                  <Badge variant="outline" className="text-[10px] font-medium">
                    {selectedDayEvents.length} {selectedDayEvents.length === 1 ? 'Event' : 'Events'}
                  </Badge>
                </div>
                
                <ScrollArea className="flex-1">
                  <div className="p-4 space-y-3">
                    {selectedDayEvents.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                          <CalendarIcon className="w-6 h-6 text-slate-400" />
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400">No events scheduled for this day</p>
                        <Button 
                          variant="link" 
                          className="text-indigo-600 dark:text-indigo-400 text-xs mt-1"
                          onClick={() => setIsEventDialogOpen(true)}
                        >
                          Create one now
                        </Button>
                      </div>
                    ) : (
                      selectedDayEvents.map((event) => (
                        <div 
                          key={event._id}
                          className="group p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:shadow-md transition-all"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <button 
                                onClick={() => handleUpdateEvent(event._id, { 
                                  status: event.status === 'completed' ? 'pending' : 'completed' 
                                })}
                                className="mt-0.5 flex-shrink-0"
                              >
                                {event.status === 'completed' ? (
                                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                ) : (
                                  <Circle className="w-5 h-5 text-slate-300 hover:text-indigo-500 transition-colors" />
                                )}
                              </button>
                              <div className="min-w-0">
                                <h4 className={`text-sm font-semibold ${event.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-800 dark:text-slate-100'}`}>
                                  {event.title}
                                </h4>
                                {event.description && (
                                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                                    {event.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge 
                                    className="text-[9px] px-1.5 py-0 capitalize"
                                    style={{ 
                                      backgroundColor: `${event.color}20`, 
                                      color: event.color,
                                      borderColor: `${event.color}40`
                                    }}
                                    variant="outline"
                                  >
                                    {event.type}
                                  </Badge>
                                  {event.allDay && (
                                    <span className="text-[10px] text-slate-400">All day</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20"
                                onClick={() => handleEditClick(event)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                                onClick={() => handleDeleteEvent(event._id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
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

      {/* Event Dialog */}
      <Dialog open={isEventDialogOpen} onOpenChange={(open) => {
        setIsEventDialogOpen(open);
        if (!open) resetEventForm();
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleSubmitEvent}>
            <DialogHeader>
              <DialogTitle>{editingEvent ? 'Edit Event' : 'Add New Event'}</DialogTitle>
              <DialogDescription>
                Create a task or event for {format(selectedDate, "MMMM d, yyyy")}.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="Event title"
                  value={eventFormData.title}
                  onChange={(e) => setEventFormData({ ...eventFormData, title: e.target.value })}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Add details about this event"
                  value={eventFormData.description}
                  onChange={(e) => setEventFormData({ ...eventFormData, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="type">Type</Label>
                  <Select 
                    value={eventFormData.type} 
                    onValueChange={(value) => setEventFormData({ ...eventFormData, type: value })}
                  >
                    <SelectTrigger id="type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="event">Event</SelectItem>
                      <SelectItem value="task">Task</SelectItem>
                      <SelectItem value="meeting">Meeting</SelectItem>
                      <SelectItem value="deadline">Deadline</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="color">Color</Label>
                  <Select 
                    value={eventFormData.color} 
                    onValueChange={(value) => setEventFormData({ ...eventFormData, color: value })}
                  >
                    <SelectTrigger id="color">
                      <SelectValue placeholder="Select color" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="#10b981">Green</SelectItem>
                      <SelectItem value="#3b82f6">Blue</SelectItem>
                      <SelectItem value="#f59e0b">Amber</SelectItem>
                      <SelectItem value="#ef4444">Red</SelectItem>
                      <SelectItem value="#8b5cf6">Purple</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsEventDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                disabled={isSubmittingEvent}
              >
                {isSubmittingEvent ? 'Saving...' : 'Save Event'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DashboardPage;
