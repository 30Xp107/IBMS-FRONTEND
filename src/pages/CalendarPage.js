import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  eachDayOfInterval,
  parseISO,
  isValid,
  isWithinInterval,
  startOfDay,
  endOfDay
} from "date-fns";
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Calendar as CalendarIcon, 
  Clock, 
  Trash2,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
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
import { Checkbox } from "@/components/ui/checkbox";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const EVENT_TYPE_COLORS = {
  event: '#3b82f6',
  task: '#8b5cf6',
  meeting: '#10b981',
  deadline: '#f59e0b',
};

const CalendarPage = () => {
  const { api, user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState("month");
  
  // Dialog states
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [isSubmittingEvent, setIsSubmittingEvent] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [eventFormData, setEventFormData] = useState({
    title: "",
    description: "",
    type: "event",
    start: new Date(),
    end: addDays(new Date(), 1),
    allDay: false,
    isShared: false,
    color: EVENT_TYPE_COLORS.event
  });

  // Filter states
  const [filters, setFilters] = useState({
    task: true,
    event: true,
    meeting: true,
    deadline: true
  });

  const allSelected = Object.values(filters).every(v => v);

  const toggleAllFilters = (checked) => {
    const newState = Object.keys(filters).reduce((acc, key) => {
      acc[key] = !!checked;
      return acc;
    }, {});
    setFilters(newState);
  };

  const canEdit = !editingEvent || editingEvent.userId?._id === user?.id;

  const fetchEvents = useCallback(async () => {
    try {
      setIsLoading(true);
      let start, end;
      
      if (view === "month") {
        start = startOfMonth(currentMonth);
        end = endOfMonth(currentMonth);
      } else if (view === "week") {
        start = startOfWeek(currentMonth);
        end = endOfWeek(currentMonth);
      } else {
        start = startOfDay(currentMonth);
        end = endOfDay(currentMonth);
      }
      
      const res = await api.get("/calendar-events", {
        params: {
          start: start.toISOString(),
          end: end.toISOString()
        }
      });
      setEvents(res.data.events || []);
    } catch (error) {
      console.error("Failed to fetch events:", error);
      toast.error("Failed to load events");
    } finally {
      setIsLoading(false);
    }
  }, [currentMonth, view, api]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const nextMonth = () => {
    if (view === "month") setCurrentMonth(addMonths(currentMonth, 1));
    else if (view === "week") setCurrentMonth(addDays(currentMonth, 7));
    else setCurrentMonth(addDays(currentMonth, 1));
  };

  const prevMonth = () => {
    if (view === "month") setCurrentMonth(subMonths(currentMonth, 1));
    else if (view === "week") setCurrentMonth(addDays(currentMonth, -7));
    else setCurrentMonth(addDays(currentMonth, -1));
  };
  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDate(today);
  };

  const handleDayClick = (day) => {
    setSelectedDate(day);
  };

  const handleAddEvent = () => {
    setEditingEvent(null);
    const startDate = selectedDate || new Date();
    // Default end time is 1 hour after start
    const endDate = new Date(startDate);
    endDate.setHours(endDate.getHours() + 1);

    setEventFormData({
      title: "",
      description: "",
      type: "event",
      start: startDate,
      end: endDate,
      allDay: false,
      isShared: false,
      color: EVENT_TYPE_COLORS.event
    });
    setIsEventDialogOpen(true);
  };

  const handleEditEvent = (event, e) => {
    e.stopPropagation();
    setEditingEvent(event);
    setEventFormData({
      title: event.title,
      description: event.description || "",
      type: event.type,
      start: new Date(event.start),
      end: event.end ? new Date(event.end) : new Date(new Date(event.start).getTime() + 3600000),
      allDay: event.allDay,
      isShared: event.isShared || false,
      color: EVENT_TYPE_COLORS[event.type] || event.color
    });
    setIsEventDialogOpen(true);
  };

  // Helpers for date/time strings
  const getDateTimeString = (date) => {
    if (!date || !isValid(date)) return "";
    return format(date, "yyyy-MM-dd'T'HH:mm");
  };

  const handleDateChange = (field, value) => {
    let newDate;
    if (eventFormData.allDay) {
      const [year, month, day] = value.split('-').map(Number);
      newDate = new Date(year, month - 1, day);
      if (field === 'end') newDate = endOfDay(newDate);
      else newDate = startOfDay(newDate);
    } else {
      newDate = new Date(value);
    }

    if (isValid(newDate)) {
      setEventFormData(prev => {
        const updated = { ...prev, [field]: newDate };
        if (field === 'start' && updated.end < updated.start) {
          updated.end = new Date(updated.start.getTime() + 3600000);
        }
        return updated;
      });
    }
  };

  const handleSubmitEvent = async (e) => {
    e.preventDefault();
    try {
      setIsSubmittingEvent(true);
      const payload = {
        ...eventFormData,
        isShared: user?.role === 'admin' ? eventFormData.isShared : false,
        start: eventFormData.start.toISOString(),
        end: eventFormData.end.toISOString()
      };

      if (editingEvent) {
        const res = await api.put(`/calendar-events/${editingEvent._id}`, payload);
        setEvents(events.map(ev => ev._id === editingEvent._id ? res.data.event : ev));
        toast.success("Event updated successfully");
      } else {
        const res = await api.post("/calendar-events", payload);
        setEvents([...events, res.data.event]);
        toast.success("Event created successfully");
      }
      setIsEventDialogOpen(false);
    } catch (error) {
      toast.error(editingEvent ? "Failed to update event" : "Failed to create event");
    } finally {
      setIsSubmittingEvent(false);
    }
  };

  const handleDeleteEvent = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this event?")) return;
    try {
      await api.delete(`/calendar-events/${id}`);
      setEvents(events.filter(e => e._id !== id));
      toast.success("Event deleted successfully");
    } catch (error) {
      toast.error("Failed to delete event");
    }
  };

  const toggleEventStatus = async (event, e) => {
    e.stopPropagation();
    try {
      const newStatus = event.status === 'completed' ? 'pending' : 'completed';
      const res = await api.put(`/calendar-events/${event._id}`, { status: newStatus });
      setEvents(events.map(ev => ev._id === event._id ? res.data.event : ev));
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  // Calendar Grid Rendering
  const renderHeader = () => {
    return (
      <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-3 sm:py-2.5 border-b dark:border-slate-800 bg-white dark:bg-[#0a0f1c] sticky top-0 z-10 gap-3 sm:gap-4">
        <div className="flex items-center justify-between w-full sm:w-auto gap-4">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 truncate max-w-[150px] sm:max-w-none">
            {view === 'month' && format(currentMonth, "MMMM yyyy")}
            {view === 'week' && `Week of ${format(startOfWeek(currentMonth), "MMM d")}`}
            {view === 'day' && format(currentMonth, "MMMM d, yyyy")}
          </h1>
          <div className="flex items-center bg-slate-100 dark:bg-slate-900/50 rounded-lg p-0.5 border dark:border-slate-800">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 rounded-md" onClick={prevMonth}>
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <Button 
              variant="ghost" 
              className="h-7 px-2 sm:px-3 text-[10px] sm:text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 rounded-md"
              onClick={goToToday}
            >
              Today
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800 rounded-md" onClick={nextMonth}>
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-end w-full sm:w-auto gap-2">
          <div className="flex items-center gap-2 flex-1 sm:flex-initial">
            <Select value={view} onValueChange={(v) => setView(v)}>
              <SelectTrigger className="flex-1 sm:w-24 h-8 rounded-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-[10px] sm:text-xs font-bold">
                <SelectValue placeholder="View" />
              </SelectTrigger>
              <SelectContent className="dark:bg-[#1e293b] dark:border-slate-700">
                <SelectItem value="month">Month</SelectItem>
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="day">Day</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 rounded-lg h-8 px-2 sm:px-3 text-[10px] sm:text-xs font-bold shadow-lg shadow-indigo-600/20 flex-1 sm:flex-initial"
              onClick={handleAddEvent}
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="inline">Add Event</span>
            </Button>
          </div>
        </div>
      </div>
    );
  };

  const renderDays = () => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const shortDays = ["S", "M", "T", "W", "T", "F", "S"];
    return (
      <div className="grid grid-cols-7 border-b dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30">
        {days.map((day, idx) => (
          <div key={day} className="py-2 text-center text-[10px] sm:text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span className="hidden sm:inline">{day}</span>
            <span className="sm:hidden">{shortDays[idx]}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderCells = () => {
    if (view === "month") return renderMonthView();
    if (view === "week") return renderWeekView();
    if (view === "day") return renderDayView();
  };

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });
    const weeks = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      weeks.push(calendarDays.slice(i, i + 7));
    }

    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-[#0a0f1c]">
        {weeks.map((weekDays, weekIdx) => (
          <div key={weekIdx} className="flex-1 flex flex-col min-h-[80px] sm:min-h-[100px] border-b dark:border-slate-800/50 relative group">
            {/* Day Cells Grid (Background) */}
            <div className="absolute inset-0 grid grid-cols-7">
              {weekDays.map((day, dayIdx) => (
                <div 
                  key={dayIdx} 
                  onClick={() => handleDayClick(day)}
                  className={`border-r dark:border-slate-800/50 cursor-pointer transition-colors ${
                    !isSameMonth(day, monthStart) ? "bg-slate-50/30 dark:bg-slate-900/10" : ""
                  } ${isSameDay(day, new Date()) ? "bg-blue-50/20 dark:bg-blue-900/10" : ""} hover:bg-slate-50/50 dark:hover:bg-slate-800/20`}
                />
              ))}
            </div>

            {/* Day Numbers */}
            <div className="grid grid-cols-7 relative z-10 pointer-events-none">
              {weekDays.map((day, dayIdx) => (
                <div key={dayIdx} className="p-1 sm:p-1.5 flex justify-center">
                  <span 
                    className={`text-xs sm:text-sm font-semibold w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center rounded-full pointer-events-auto ${
                    isSameDay(day, new Date()) 
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30" 
                      : isSameDay(day, selectedDate)
                      ? "bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                      : "text-slate-400 dark:text-slate-500"
                  }`}>
                    {format(day, "d")}
                  </span>
                </div>
              ))}
            </div>

            {/* Events Layer */}
            <div className="flex-1 relative z-10 px-0 pb-1 space-y-0.5 sm:space-y-1 overflow-hidden pointer-events-none">
              {renderEventsForWeek(weekDays)}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderEventsForWeek = (weekDays) => {
    const weekStart = startOfDay(weekDays[0]);
    const weekEnd = endOfDay(weekDays[6]);

    const weekEvents = events.filter(event => {
      const start = new Date(event.start);
      const end = event.end ? new Date(event.end) : start;
      return (start <= weekEnd && end >= weekStart) && filters[event.type];
    }).sort((a, b) => {
      const startA = new Date(a.start);
      const startB = new Date(b.start);
      if (startA.getTime() !== startB.getTime()) return startA - startB;
      const durA = (a.end ? new Date(a.end) : startA) - startA;
      const durB = (b.end ? new Date(b.end) : startB) - startB;
      return durB - durA;
    });

    const lanes = [];
    weekEvents.forEach(event => {
      const start = new Date(event.start);
      const end = event.end ? new Date(event.end) : start;
      
      const startIdx = Math.max(0, weekDays.findIndex(d => isSameDay(d, start < weekStart ? weekStart : start)));
      const endIdx = Math.max(0, weekDays.findIndex(d => isSameDay(d, end > weekEnd ? weekEnd : end)));
      
      let laneIdx = lanes.findIndex(lane => {
        return !lane.some(e => {
          const eStart = new Date(e.start);
          const eEnd = e.end ? new Date(e.end) : eStart;
          const eStartIdx = Math.max(0, weekDays.findIndex(d => isSameDay(d, eStart < weekStart ? weekStart : eStart)));
          const eEndIdx = Math.max(0, weekDays.findIndex(d => isSameDay(d, eEnd > weekEnd ? weekEnd : eEnd)));
          return (startIdx <= eEndIdx && endIdx >= eStartIdx);
        });
      });

      if (laneIdx === -1) {
        laneIdx = lanes.length;
        lanes.push([event]);
      } else {
        lanes[laneIdx].push(event);
      }
    });

    return lanes.slice(0, 3).map((lane, laneIdx) => (
      <div key={laneIdx} className="relative h-4 sm:h-5">
        {lane.map(event => {
          const start = new Date(event.start);
          const end = event.end ? new Date(event.end) : start;
          const startIdx = Math.max(0, weekDays.findIndex(d => isSameDay(d, start < weekStart ? weekStart : start)));
          const endIdx = Math.max(0, weekDays.findIndex(d => isSameDay(d, end > weekEnd ? weekEnd : end)));
          const span = endIdx - startIdx + 1;

          const isContinuingStart = start < weekStart;
          const isContinuingEnd = end > weekEnd;

          return (
            <Tooltip key={event._id}>
              <TooltipTrigger asChild>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditEvent(event, e);
                  }}
                  className={`absolute h-[16px] sm:h-[22px] text-[9px] sm:text-[12px] font-semibold flex items-center px-1 sm:px-2 cursor-pointer pointer-events-auto transition-all hover:brightness-110 active:scale-[0.98] shadow-sm ${
                    isContinuingStart ? "" : "rounded-l-md sm:rounded-l-lg ml-0.5 sm:ml-1"
                  } ${isContinuingEnd ? "" : "rounded-r-md sm:rounded-r-lg mr-0.5 sm:mr-1"}`}
                  style={{
                    left: `${(startIdx / 7) * 100}%`,
                    width: `calc(${(span / 7) * 100}% - ${isContinuingStart ? 0 : 2}px - ${isContinuingEnd ? 0 : 2}px)`,
                    backgroundColor: event.color || '#3b82f6',
                    color: '#fff',
                    zIndex: 10,
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}
                >
                  {(startIdx === 0 || isSameDay(start, weekDays[startIdx]) || (startIdx === 0 && isContinuingStart)) && (
                    <div className="flex items-center gap-1 sm:gap-1.5 w-full overflow-hidden">
                      {!event.allDay && <div className="w-0.5 h-0.5 sm:w-1 sm:h-1 rounded-full bg-white shrink-0" />}
                      <span className="truncate drop-shadow-sm">
                        {event.title}
                      </span>
                    </div>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-slate-900 border-slate-800 p-3 shadow-xl max-w-[250px]">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: event.color }} />
                    <span className="font-bold text-white text-xs uppercase tracking-wider">{event.type}</span>
                  </div>
                  <p className="font-semibold text-white text-sm">{event.title}</p>
                  {event.description && (
                    <p className="text-slate-400 text-[11px] leading-relaxed line-clamp-3 italic">"{event.description}"</p>
                  )}
                  <div className="pt-2 border-t border-slate-800 flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-indigo-400">
                      {event.userId?.name?.charAt(0)}
                    </div>
                    <span className="text-[10px] text-slate-400">
                      Created by: <span className="text-indigo-400 font-semibold">{event.userId?._id === user?.id ? "You" : event.userId?.name}</span>
                    </span>
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    ));
  };

  const renderWeekView = () => {
    const startDate = startOfWeek(currentMonth);
    const endDate = endOfWeek(currentMonth);
    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

    return (
      <div className="flex-1 flex flex-col overflow-y-auto">
        <div className="grid grid-cols-1 sm:grid-cols-7 h-full">
          {calendarDays.map((day) => {
            const dayEvents = events.filter(event => {
              const start = new Date(event.start);
              const end = event.end ? new Date(event.end) : start;
              return isWithinInterval(day, { 
                start: startOfDay(start), 
                end: endOfDay(end) 
              }) && filters[event.type];
            });

            return (
              <div 
                key={day.toString()} 
                className={`min-h-[120px] sm:min-h-[400px] border-b sm:border-r dark:border-slate-800 p-2 sm:p-3 ${
                  isSameDay(day, new Date()) ? "bg-blue-50/30 dark:bg-blue-900/10" : "bg-white dark:bg-slate-950"
                } hover:bg-slate-50 dark:hover:bg-slate-900/50 cursor-pointer transition-colors`}
                onClick={() => handleDayClick(day)}
              >
                <div className="flex sm:flex-col items-center justify-between sm:justify-start mb-2 sm:mb-4">
                  <span className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">
                    {format(day, "EEE")}
                  </span>
                  <span className={`text-sm sm:text-base font-semibold w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-full ${
                    isSameDay(day, new Date()) 
                      ? "bg-blue-600 text-white shadow-sm" 
                      : isSameDay(day, selectedDate)
                      ? "bg-slate-200 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                      : "text-slate-600 dark:text-slate-400"
                  }`}>
                    {format(day, "d")}
                  </span>
                </div>
                <div className="space-y-1">
                  {dayEvents.map((event) => (
                    <Tooltip key={event._id}>
                      <TooltipTrigger asChild>
                        <div
                          onClick={(e) => handleEditEvent(event, e)}
                          className="p-1.5 sm:p-2 rounded-lg border shadow-sm transition-all cursor-pointer"
                          style={{ 
                            backgroundColor: `${event.color}10`, 
                            color: event.color,
                            borderColor: `${event.color}20`
                          }}
                        >
                          <div className="flex items-center gap-1 sm:gap-1.5 mb-0.5">
                            <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full" style={{ backgroundColor: event.color }} />
                            <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider opacity-60">
                              {event.type}
                            </span>
                          </div>
                          <p className={`text-xs sm:text-sm font-medium leading-tight ${event.status === 'completed' ? 'line-through opacity-50' : ''}`}>
                            {event.title}
                          </p>
                          {event.userId && event.userId._id !== user?.id && (
                            <p className="text-[8px] sm:text-[9px] font-medium opacity-60 mt-0.5 truncate">
                              By: {event.userId.name}
                            </p>
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="bg-slate-900 border-slate-800 p-3 shadow-xl max-w-[250px]">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: event.color }} />
                            <span className="font-bold text-white text-xs uppercase tracking-wider">{event.type}</span>
                          </div>
                          <p className="font-semibold text-white text-sm">{event.title}</p>
                          {event.description && (
                            <p className="text-slate-400 text-[11px] leading-relaxed line-clamp-3 italic">"{event.description}"</p>
                          )}
                          <div className="pt-2 border-t border-slate-800 flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-indigo-400">
                              {event.userId?.name?.charAt(0)}
                            </div>
                            <span className="text-[10px] text-slate-400">
                              Created by: <span className="text-indigo-400 font-semibold">{event.userId?._id === user?.id ? "You" : event.userId?.name}</span>
                            </span>
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const day = currentMonth;
    const dayEvents = events.filter(event => {
      const start = new Date(event.start);
      const end = event.end ? new Date(event.end) : start;
      return isWithinInterval(day, { 
        start: startOfDay(start), 
        end: endOfDay(end) 
      }) && filters[event.type];
    });

    return (
      <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30 dark:bg-slate-950/30">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100 mb-0.5">
                {format(day, "EEEE")}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium">
                {format(day, "MMMM d, yyyy")}
              </p>
            </div>
            <Button 
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg h-10 px-4 text-xs sm:text-sm font-semibold shadow-sm"
              onClick={handleAddEvent}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Event
            </Button>
          </div>

          <div className="grid gap-3">
            {dayEvents.length > 0 ? (
              dayEvents.map((event) => (
                <Tooltip key={event._id}>
                  <TooltipTrigger asChild>
                    <div
                      onClick={(e) => handleEditEvent(event, e)}
                      className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:border-indigo-200 dark:hover:border-indigo-900 transition-all cursor-pointer group flex items-start gap-4"
                    >
                      {!event.allDay ? (
                        <div className="text-center min-w-[50px] pt-0.5">
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {format(new Date(event.start), "HH:mm")}
                          </p>
                          <p className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            Start
                          </p>
                        </div>
                      ) : (
                        <div className="text-center min-w-[50px] pt-0.5">
                          <p className="text-[10px] sm:text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
                            All Day
                          </p>
                        </div>
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: event.color }} />
                          <span className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            {event.type}
                          </span>
                        </div>
                        <h4 className={`text-base font-semibold text-slate-900 dark:text-white mb-1 truncate ${event.status === 'completed' ? 'line-through opacity-50' : ''}`}>
                          {event.title}
                        </h4>
                        {event.description && (
                          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 line-clamp-1">
                            {event.description}
                          </p>
                        )}
                        {event.userId && (
                          <div className="flex items-center gap-1.5 mt-2">
                            <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-500">
                              {event.userId.name?.charAt(0)}
                            </div>
                            <span className="text-[10px] sm:text-xs font-medium text-slate-400">
                              {event.userId._id === user?.id ? "You" : event.userId.name}
                              {event.isShared && user?.role === 'admin' && (
                                <span className="ml-2 text-[10px] text-emerald-500 font-semibold uppercase tracking-wider bg-emerald-500/10 px-1.5 py-0.5 rounded">Shared</span>
                              )}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {event.userId?._id === user?.id && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                            onClick={(e) => handleEditEvent(event, e)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                        {(event.userId?._id === user?.id || user?.role === 'admin') && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-400 hover:text-rose-600"
                            onClick={(e) => handleDeleteEvent(event._id, e)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="bg-slate-900 border-slate-800 p-3 shadow-xl max-w-[250px]">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: event.color }} />
                        <span className="font-bold text-white text-xs uppercase tracking-wider">{event.type}</span>
                      </div>
                      <p className="font-semibold text-white text-sm">{event.title}</p>
                      {event.description && (
                        <p className="text-slate-400 text-[11px] leading-relaxed line-clamp-3 italic">"{event.description}"</p>
                      )}
                      <div className="pt-2 border-t border-slate-800 flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-indigo-400">
                          {event.userId?.name?.charAt(0)}
                        </div>
                        <span className="text-[10px] text-slate-400">
                          Created by: <span className="text-indigo-400 font-semibold">{event.userId?._id === user?.id ? "You" : event.userId?.name}</span>
                        </span>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              ))
            ) : (
              <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800">
                <CalendarIcon className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">No events scheduled for this day</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderSidebar = () => {
    const miniCalendarStart = startOfWeek(startOfMonth(currentMonth));
    const miniCalendarEnd = endOfWeek(endOfMonth(currentMonth));
    const miniCalendarDays = eachDayOfInterval({
      start: miniCalendarStart,
      end: miniCalendarEnd
    });

    return (
      <div className="w-64 border-r dark:border-slate-800 bg-white dark:bg-[#0a0f1c] hidden xl:flex flex-col">
        <div className="p-4 space-y-6">
          {/* Mini Calendar */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {format(currentMonth, "MMMM yyyy")}
              </h3>
              <div className="flex gap-0.5">
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={prevMonth}>
                  <ChevronLeft className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={nextMonth}>
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center">
              {["S", "M", "T", "W", "T", "F", "S"].map(d => (
                <span key={d} className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{d}</span>
              ))}
              {miniCalendarDays.map((day, i) => (
                <span 
                  key={day.toString()} 
                  onClick={() => handleDayClick(day)}
                  className={`text-xs h-6 w-6 flex items-center justify-center rounded-full cursor-pointer transition-colors ${
                    !isSameMonth(day, currentMonth) 
                      ? "text-slate-300 dark:text-slate-800" 
                      : isSameDay(day, new Date())
                      ? "bg-indigo-600 text-white font-semibold shadow-sm shadow-indigo-600/20"
                      : isSameDay(day, selectedDate)
                      ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-semibold"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-900"
                  }`}
                >
                  {format(day, "d")}
                </span>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wider">Filters</h3>
              <Plus className="w-3 h-3 text-slate-400 cursor-pointer hover:text-indigo-600 transition-colors" onClick={handleAddEvent} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 px-1 group border-b dark:border-slate-800 pb-2 mb-2">
                <Checkbox 
                  id="all" 
                  checked={allSelected} 
                  onCheckedChange={toggleAllFilters}
                  className="h-3.5 w-3.5 border-slate-300 dark:border-slate-700 data-[state=checked]:bg-indigo-600"
                />
                <Label 
                  htmlFor="all" 
                  className="text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer flex-1 group-hover:text-slate-900 dark:group-hover:text-slate-200 transition-colors"
                >
                  All Categories
                </Label>
              </div>
              {[
                { id: 'event', label: 'Events', color: EVENT_TYPE_COLORS.event },
                { id: 'task', label: 'Tasks', color: EVENT_TYPE_COLORS.task },
                { id: 'meeting', label: 'Meetings', color: EVENT_TYPE_COLORS.meeting },
                { id: 'deadline', label: 'Deadlines', color: EVENT_TYPE_COLORS.deadline },
              ].map((item) => (
                <div key={item.id} className="flex items-center gap-2.5 px-1 group">
                  <Checkbox 
                    id={item.id} 
                    checked={filters[item.id]} 
                    onCheckedChange={(checked) => setFilters(prev => ({ ...prev, [item.id]: !!checked }))}
                    className="h-3.5 w-3.5 border-slate-300 dark:border-slate-700 data-[state=checked]:bg-indigo-600"
                  />
                  <Label 
                    htmlFor={item.id} 
                    className="text-xs font-medium text-slate-600 dark:text-slate-400 cursor-pointer flex-1 group-hover:text-slate-900 dark:group-hover:text-slate-200 transition-colors"
                  >
                    {item.label}
                  </Label>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: item.color }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <TooltipProvider>
      <div className="h-[calc(100vh-1rem)] sm:h-[calc(100vh-2rem)] flex bg-white dark:bg-slate-950 rounded-xl sm:rounded-3xl overflow-hidden shadow-2xl border dark:border-slate-800">
        {renderSidebar()}
        
        <div className="flex-1 flex flex-col min-w-0">
          {renderHeader()}
          <div className="flex-1 flex flex-col overflow-hidden">
            {renderDays()}
            {renderCells()}
          </div>
        </div>

        {/* Event Dialog */}
        <Dialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen}>
          <DialogContent className="max-w-[95vw] sm:max-w-[500px] rounded-[24px] bg-[#0f172a] border-slate-800 text-slate-100 p-0 shadow-2xl overflow-hidden">
            <form onSubmit={handleSubmitEvent} className="flex flex-col max-h-[90vh]">
              <div className="p-6 pb-0 shrink-0">
                <DialogHeader className="space-y-1">
                  <div className="flex items-center justify-between">
                    <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight text-white">
                      {editingEvent ? 'Edit Event' : 'Add Event'}
                    </DialogTitle>
                  </div>
                  <DialogDescription className="text-slate-400 text-xs sm:text-sm">
                    Schedule something for {format(eventFormData.start, "MMMM d, yyyy")}
                  </DialogDescription>
                </DialogHeader>
              </div>

              <ScrollArea className="flex-1 px-6">
                <div className="space-y-4 py-6">
                  <div className="space-y-1.5">
                    <Label htmlFor="title" className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">Event Title</Label>
                    <Input
                      id="title"
                      placeholder="What's happening?"
                      className="rounded-xl bg-[#1e293b] border-slate-700/50 h-10 text-sm text-white placeholder:text-slate-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                      value={eventFormData.title}
                      onChange={(e) => setEventFormData({ ...eventFormData, title: e.target.value })}
                      required
                      disabled={!canEdit}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="description" className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">Description</Label>
                    <Textarea
                      id="description"
                      placeholder="Add more details..."
                      className="rounded-xl bg-[#1e293b] border-slate-700/50 min-h-[80px] text-sm text-white placeholder:text-slate-500 focus:ring-1 focus:ring-indigo-500 transition-all resize-none"
                      value={eventFormData.description}
                      onChange={(e) => setEventFormData({ ...eventFormData, description: e.target.value })}
                      disabled={!canEdit}
                    />
                  </div>

                  <div className="space-y-3">
                    <Label className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">Timeline</Label>
                    <div className="space-y-3">
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#1e293b] border border-slate-700/50 group focus-within:border-indigo-500/50 transition-all">
                          <div className="w-10 h-10 rounded-xl bg-slate-800/50 flex items-center justify-center text-slate-400 group-focus-within:text-indigo-400 shrink-0">
                            <CalendarIcon className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight mb-1">Start Date & Time</p>
                            <Input
                              type={eventFormData.allDay ? "date" : "datetime-local"}
                              className="h-7 bg-transparent border-none text-[14px] text-white focus-visible:ring-0 p-0 font-medium w-full [color-scheme:dark]"
                              value={eventFormData.allDay ? format(eventFormData.start, "yyyy-MM-dd") : getDateTimeString(eventFormData.start)}
                              onChange={(e) => handleDateChange('start', e.target.value)}
                              disabled={!canEdit}
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#1e293b] border border-slate-700/50 group focus-within:border-indigo-500/50 transition-all">
                          <div className="w-10 h-10 rounded-xl bg-slate-800/50 flex items-center justify-center text-slate-400 group-focus-within:text-indigo-400 shrink-0">
                            <Clock className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-tight mb-1">End Date & Time</p>
                            <Input
                              type={eventFormData.allDay ? "date" : "datetime-local"}
                              className="h-7 bg-transparent border-none text-[14px] text-white focus-visible:ring-0 p-0 font-medium w-full [color-scheme:dark]"
                              value={eventFormData.allDay ? format(eventFormData.end, "yyyy-MM-dd") : getDateTimeString(eventFormData.end)}
                              onChange={(e) => handleDateChange('end', e.target.value)}
                              disabled={!canEdit}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="type" className="text-xs font-semibold text-slate-400 uppercase tracking-wider ml-1">Type</Label>
                    <Select 
                      value={eventFormData.type} 
                      onValueChange={(value) => setEventFormData({ 
                        ...eventFormData, 
                        type: value,
                        color: EVENT_TYPE_COLORS[value] || eventFormData.color
                      })}
                      disabled={!canEdit}
                    >
                      <SelectTrigger className="rounded-xl bg-[#1e293b] border-slate-700/50 h-10 text-sm text-white focus:ring-1 focus:ring-indigo-500 transition-all">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1e293b] border-slate-700 text-white">
                        <SelectItem value="event">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: EVENT_TYPE_COLORS.event }} />
                            <span>Event</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="task">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: EVENT_TYPE_COLORS.task }} />
                            <span>Task</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="meeting">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: EVENT_TYPE_COLORS.meeting }} />
                            <span>Meeting</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="deadline">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: EVENT_TYPE_COLORS.deadline }} />
                            <span>Deadline</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    <Checkbox 
                      id="allDay" 
                      checked={eventFormData.allDay} 
                      onCheckedChange={(checked) => {
                        const isAllDay = !!checked;
                        setEventFormData(prev => {
                          const updated = { ...prev, allDay: isAllDay };
                          if (isAllDay) {
                            updated.start = startOfDay(prev.start);
                            updated.end = endOfDay(prev.end || prev.start);
                          }
                          return updated;
                        });
                      }}
                      className="rounded-md border-slate-600 bg-[#1e293b] data-[state=checked]:bg-indigo-600 data-[state=checked]:border-indigo-600"
                      disabled={!canEdit}
                    />
                    <Label htmlFor="allDay" className="text-xs font-semibold text-slate-400 cursor-pointer select-none">All day event</Label>
                  </div>

                  {user?.role === 'admin' && (
                    <div className="flex items-center gap-3 pt-1">
                      <Checkbox 
                        id="isShared" 
                        checked={eventFormData.isShared} 
                        onCheckedChange={(checked) => setEventFormData({ ...eventFormData, isShared: !!checked })}
                        className="rounded-md border-slate-600 bg-[#1e293b] data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
                        disabled={!canEdit}
                      />
                      <Label htmlFor="isShared" className="text-xs font-semibold text-slate-400 cursor-pointer select-none">Share with all users</Label>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <DialogFooter className="flex items-center justify-between gap-4 p-6 shrink-0 bg-[#1e293b]/30 border-t border-slate-800/50">
                <div className="flex-1 flex justify-start">
                  {editingEvent && (editingEvent.userId?._id === user?.id || user?.role === 'admin') && (
                    <Button 
                      type="button" 
                      variant="ghost" 
                      className="text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl h-10 px-3 text-xs font-bold group transition-all"
                      onClick={(e) => handleDeleteEvent(editingEvent._id, e)}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-2 group-hover:scale-110 transition-transform" />
                      Delete
                    </Button>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <Button 
                    type="button" 
                    variant="ghost" 
                    className="rounded-xl h-10 px-4 text-xs text-slate-300 hover:text-white hover:bg-slate-800 font-bold transition-all"
                    onClick={() => setIsEventDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  {( !editingEvent || editingEvent.userId?._id === user?.id) && (
                    <Button 
                      type="submit" 
                      className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl h-10 px-6 text-xs font-bold shadow-lg shadow-indigo-600/20 transition-all active:scale-95 disabled:opacity-50 whitespace-nowrap"
                      disabled={isSubmittingEvent}
                    >
                      {isSubmittingEvent ? 'Saving...' : (editingEvent ? 'Save Changes' : 'Create Event')}
                    </Button>
                  )}
                </div>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};

export default CalendarPage;
