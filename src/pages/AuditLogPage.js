import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ClipboardList, Plus, Edit, Trash2, ArrowRight, Search, Eye, Download, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import * as XLSX from "xlsx";

const AuditLogPage = () => {
  const { api } = useAuth();
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedLog, setSelectedLog] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: "timestamp", direction: "desc" });
  const [totalLogs, setTotalLogs] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset to page 1 when search, filter, or limit changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, moduleFilter, itemsPerPage]);

  useEffect(() => {
    fetchLogs();
  }, [currentPage, moduleFilter, debouncedSearch, sortConfig, itemsPerPage]);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      let query = `?page=${currentPage}&limit=${itemsPerPage}&sort=${sortConfig.key}&order=${sortConfig.direction}`;
      if (moduleFilter) query += `&module=${moduleFilter}`;
      if (debouncedSearch) query += `&search=${debouncedSearch}`;
      
      const response = await api.get(`/audit-logs${query}`);
      setLogs(response.data.logs || []);
      setTotalLogs(response.data.total || 0);
      setTotalPages(response.data.totalPages || 1);
    } catch (error) {
      toast.error("Failed to load audit logs");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="w-3 h-3 ml-1" />;
    return sortConfig.direction === "asc" ? <ArrowUp className="w-3 h-3 ml-1" /> : <ArrowDown className="w-3 h-3 ml-1" />;
  };

  // Pagination logic
  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  const handleRowClick = (log) => {
    setSelectedLog(log);
    setIsModalOpen(true);
  };

  const handleExport = async () => {
    try {
      const toastId = toast.loading("Preparing export...");
      
      // Fetch all logs with current filters but no pagination
      let query = `?limit=all&sort=${sortConfig.key}&order=${sortConfig.direction}`;
      if (moduleFilter) query += `&module=${moduleFilter}`;
      if (debouncedSearch) query += `&search=${debouncedSearch}`;
      
      const response = await api.get(`/audit-logs${query}`);
      const allLogs = response.data.logs || [];
      
      if (allLogs.length === 0) {
        toast.dismiss(toastId);
        toast.error("No data to export");
        return;
      }

      const exportData = allLogs.map(log => ({
        "Timestamp": new Date(log.createdAt).toLocaleString(),
        "User": log.user_name,
        "Action": log.action,
        "Module": log.module,
        "Record ID": log.record_id,
        "Old Value": log.old_value || "-",
        "New Value": log.new_value || "-"
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Audit Logs");
      
      const wscols = [
        { wch: 25 }, // Timestamp
        { wch: 20 }, // User
        { wch: 15 }, // Action
        { wch: 15 }, // Module
        { wch: 25 }, // Record ID
        { wch: 40 }, // Old Value
        { wch: 40 }, // New Value
      ];
      worksheet["!cols"] = wscols;

      XLSX.writeFile(workbook, `audit_logs_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.dismiss(toastId);
      toast.success(`Exported ${allLogs.length} logs`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export logs");
    }
  };

  // Sorting is now handled on the server side
  const displayLogs = logs;

  const getPaginationRange = () => {
    const delta = 1;
    const range = [];
    const left = currentPage - delta;
    const right = currentPage + delta;
    let l;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= left && i <= right)) {
        if (l) {
          if (i - l === 2) {
            range.push(l + 1);
          } else if (i - l !== 1) {
            range.push("...");
          }
        }
        range.push(i);
        l = i;
      }
    }
    return range;
  };

  const getActionBadge = (action) => {
    switch (action) {
      case "CREATE":
        return (
          <Badge variant="outline" className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">
            <Plus className="w-3 h-3 mr-1" />
            Create
          </Badge>
        );
      case "UPDATE":
        return (
          <Badge variant="outline" className="bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800">
            <Edit className="w-3 h-3 mr-1" />
            Update
          </Badge>
        );
      case "DELETE":
        return (
          <Badge variant="outline" className="bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800">
            <Trash2 className="w-3 h-3 mr-1" />
            Delete
          </Badge>
        );
      default:
        return <Badge variant="outline" className="dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">{action}</Badge>;
    }
  };

  const getModuleBadge = (module) => {
    const colors = {
      beneficiaries: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800",
      redemptions: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800",
      nes: "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-800",
      users: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/30 dark:text-slate-400 dark:border-slate-700",
      areas: "bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-900/30 dark:text-pink-400 dark:border-pink-800",
      calendar: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
      system_config: "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800",
    };
    return (
      <Badge variant="outline" className={colors[module] || "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/30 dark:text-slate-400 dark:border-slate-700"}>
        {module}
      </Badge>
    );
  };

  const formatTimestamp = (timestamp) => {
    // Try both timestamp and createdAt as the backend uses createdAt via timestamps: true
    const dateObj = new Date(timestamp);
    
    if (isNaN(dateObj.getTime())) {
      return {
        date: "Invalid Date",
        time: "",
      };
    }

    return {
      date: dateObj.toLocaleDateString(),
      time: dateObj.toLocaleTimeString(),
    };
  };

  const renderChanges = (log) => {
    const isJson = (str) => {
      try {
        JSON.parse(str);
        return true;
      } catch (e) {
        return false;
      }
    };

    if (log.field_name && !["All Fields (Initial)", "All Fields (Deleted)", "Modified Fields"].includes(log.field_name)) {
      return (
        <div className="text-sm">
          <div className="font-medium text-slate-700 dark:text-slate-300">{log.field_name}</div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-rose-600 dark:text-rose-400 line-through">
              {log.old_value || "(empty)"}
            </span>
            <ArrowRight className="w-3 h-3 text-slate-400 dark:text-slate-600" />
            <span className="text-emerald-600 dark:text-emerald-400">
              {log.new_value || "(empty)"}
            </span>
          </div>
        </div>
      );
    }

    // Handle cases where field_name is missing or is one of our default ones
    if (log.action === "CREATE") {
      return <span className="text-emerald-600 dark:text-emerald-400 text-xs font-medium">New Record Created</span>;
    }
    if (log.action === "DELETE") {
      return <span className="text-rose-600 dark:text-rose-400 text-xs font-medium">Record Removed</span>;
    }
    if (log.action === "UPDATE") {
      try {
        const oldVal = isJson(log.old_value) ? JSON.parse(log.old_value) : null;
        const newVal = isJson(log.new_value) ? JSON.parse(log.new_value) : null;
        
        if (oldVal && newVal) {
          const changedFields = Object.keys(newVal).filter(key => 
            JSON.stringify(oldVal[key]) !== JSON.stringify(newVal[key])
          );
          
          if (changedFields.length > 0) {
            return (
              <div className="text-xs text-slate-600 dark:text-slate-400">
                Changed: <span className="font-medium text-slate-800 dark:text-slate-200">{changedFields.join(", ")}</span>
              </div>
            );
          }
        }
      } catch (e) {}
      return <span className="text-sky-600 dark:text-sky-400 text-xs font-medium">Record Updated</span>;
    }

    return <span className="text-slate-400 dark:text-slate-600">-</span>;
  };

  const knownModules = ["beneficiaries", "redemptions", "nes", "users", "areas", "calendar", "system_config"];
  const uniqueModules = [...new Set([...knownModules, ...logs.map((log) => log.module)])];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="text-center sm:text-left">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100">Audit Trail</h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Track all changes made to the system</p>
        </div>
        <div className="flex justify-end w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={handleExport}
            className="border-emerald-600 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 dark:border-emerald-500 dark:text-emerald-400 text-xs sm:text-sm h-9 sm:h-10 w-full sm:w-auto"
          >
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Filter and Search */}
      <Card className="border-stone-200 dark:border-slate-800 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search by user, action, module, or record ID..."
                className="pl-10 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={moduleFilter || "all"} onValueChange={(v) => setModuleFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-full md:w-48 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200">
                <SelectValue placeholder="All Modules" />
              </SelectTrigger>
              <SelectContent className="dark:bg-slate-900 dark:border-slate-800">
                <SelectItem value="all">All Modules</SelectItem>
                {uniqueModules.map((module) => (
                  <SelectItem key={module} value={module}>
                    {module}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={itemsPerPage.toString()} onValueChange={(v) => setItemsPerPage(v === "all" ? "all" : parseInt(v))}>
              <SelectTrigger className="w-full md:w-32 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200">
                <SelectValue placeholder="Rows" />
              </SelectTrigger>
              <SelectContent className="dark:bg-slate-900 dark:border-slate-800">
                <SelectItem value="10">10 rows</SelectItem>
                <SelectItem value="20">20 rows</SelectItem>
                <SelectItem value="50">50 rows</SelectItem>
                <SelectItem value="100">100 rows</SelectItem>
                <SelectItem value="all">Show All</SelectItem>
              </SelectContent>
            </Select>

          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-stone-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-emerald-600" />
            Audit Logs ({totalLogs})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && logs.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="spinner" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-stone-100 dark:bg-slate-800/50 border-b dark:border-slate-800">
                    <TableHead 
                      className="font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-left pl-6"
                      onClick={() => handleSort("timestamp")}
                    >
                      <div className="flex items-center justify-start">
                        Timestamp {getSortIcon("timestamp")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-center"
                      onClick={() => handleSort("user_name")}
                    >
                      <div className="flex items-center justify-center">
                        User {getSortIcon("user_name")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-center"
                      onClick={() => handleSort("action")}
                    >
                      <div className="flex items-center justify-center">
                        Action {getSortIcon("action")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-center hidden sm:table-cell"
                      onClick={() => handleSort("module")}
                    >
                      <div className="flex items-center justify-center">
                        Module {getSortIcon("module")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-center hidden lg:table-cell"
                      onClick={() => handleSort("record_id")}
                    >
                      <div className="flex items-center justify-center">
                        Record ID {getSortIcon("record_id")}
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-slate-600 dark:text-slate-300 text-center hidden md:table-cell">Changes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {displayLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-slate-500">
                        No logs found matching your criteria.
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayLogs.map((log) => (
                      <TableRow 
                        key={log.id || log._id} 
                        className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors"
                        onClick={() => handleRowClick(log)}
                      >
                        <TableCell className="py-3 text-left pl-6">
                          <div className="flex flex-col items-start">
                            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                              {formatTimestamp(log.timestamp || log.createdAt).date}
                            </span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-500">
                              {formatTimestamp(log.timestamp || log.createdAt).time}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3 text-center">
                          <div className="flex flex-col items-center">
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                              {log.user_name}
                            </span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-500">
                              {log.user_role}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="py-3 text-center">
                          <div className="flex justify-center">
                            {getActionBadge(log.action)}
                          </div>
                        </TableCell>
                        <TableCell className="py-3 text-center hidden sm:table-cell">
                          <div className="flex justify-center">
                            {getModuleBadge(log.module)}
                          </div>
                        </TableCell>
                        <TableCell className="py-3 font-mono text-xs text-slate-500 dark:text-slate-400 text-center hidden lg:table-cell">
                          {log.record_id ? `${log.record_id.substring(0, 8)}...` : "-"}
                        </TableCell>
                        <TableCell className="py-3 text-center hidden md:table-cell">
                          <div className="flex items-center justify-center gap-2">
                            {renderChanges(log)}
                            <Eye className="w-4 h-4 text-slate-400" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && itemsPerPage !== "all" && (
        <div className="flex items-center justify-center gap-2 py-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Previous
          </Button>
          {getPaginationRange().map((page, index) => (
            <div key={index} className="flex items-center">
              {page === "..." ? (
                <span className="px-2 text-slate-400 dark:text-slate-600">...</span>
              ) : (
                <Button
                  variant={currentPage === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 ${currentPage === page ? 'dark:bg-emerald-600 dark:text-white' : 'dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800'}`}
                >
                  {page}
                </Button>
              )}
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Next
          </Button>
        </div>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto dark:bg-slate-900 dark:border-slate-800 max-w-[95vw] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <ClipboardList className="w-5 h-5 text-emerald-600" />
              Audit Log Details
            </DialogTitle>
            <DialogDescription>
              Detailed information about this system change
            </DialogDescription>
          </DialogHeader>

          {selectedLog && (
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Timestamp</p>
                  <p className="text-slate-900 dark:text-slate-200">
                    {formatTimestamp(selectedLog.timestamp || selectedLog.createdAt).date} {formatTimestamp(selectedLog.timestamp || selectedLog.createdAt).time}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">User</p>
                  <div className="flex items-center gap-2">
                    <p className="text-slate-900 dark:text-slate-200 font-medium">{selectedLog.user_name}</p>
                    <Badge variant="outline" className="capitalize text-[10px] h-4 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">{selectedLog.user_role}</Badge>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Action</p>
                  <div>{getActionBadge(selectedLog.action)}</div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Module</p>
                  <div>{getModuleBadge(selectedLog.module)}</div>
                </div>
                <div className="col-span-2 space-y-1">
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Record ID</p>
                  <p className="text-slate-900 dark:text-slate-300 font-mono text-xs bg-slate-50 dark:bg-slate-800 p-2 rounded border border-slate-100 dark:border-slate-700">
                    {selectedLog.record_id}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 border-b dark:border-slate-800 pb-1">Data Changes</p>
                
                {selectedLog.field_name && !["All Fields (Initial)", "All Fields (Deleted)", "Modified Fields"].includes(selectedLog.field_name) ? (
                  <div className="grid grid-cols-1 gap-4">
                    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                      <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">{selectedLog.field_name}</p>
                      <div className="flex flex-col gap-3">
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-rose-500 dark:text-rose-400 uppercase tracking-wider">Old Value</span>
                          <p className="text-sm text-slate-600 dark:text-slate-400 bg-rose-50/50 dark:bg-rose-900/20 p-2 rounded border border-rose-100 dark:border-rose-800/30 line-through italic">
                            {selectedLog.old_value || "(empty)"}
                          </p>
                        </div>
                        <div className="flex justify-center">
                          <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-emerald-500 dark:text-emerald-400 uppercase tracking-wider">New Value</span>
                          <p className="text-sm text-slate-900 dark:text-slate-200 bg-emerald-50/50 dark:bg-emerald-900/20 p-2 rounded border border-emerald-100 dark:border-emerald-800/30 font-medium">
                            {selectedLog.new_value || "(empty)"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(() => {
                      if (selectedLog.action === "UPDATE") {
                        try {
                          const oldData = JSON.parse(selectedLog.old_value);
                          const newData = JSON.parse(selectedLog.new_value);
                          const changedFields = Object.keys(newData).filter(key => 
                            JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])
                          );

                          if (changedFields.length > 0) {
                            return (
                              <div className="space-y-3">
                                {changedFields.map(field => (
                                  <div key={field} className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700">
                                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase mb-2">{field.replace(/_/g, ' ')}</p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                                      <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-rose-500 dark:text-rose-400 uppercase tracking-wider">From</span>
                                        <p className="text-sm text-slate-600 dark:text-slate-400 bg-rose-50/50 dark:bg-rose-900/20 p-2 rounded border border-rose-100 dark:border-rose-800/30 line-through italic">
                                          {String(oldData[field]) || "(empty)"}
                                        </p>
                                      </div>
                                      <div className="space-y-1">
                                        <span className="text-[10px] font-bold text-emerald-500 dark:text-emerald-400 uppercase tracking-wider">To</span>
                                        <p className="text-sm text-slate-900 dark:text-slate-200 bg-emerald-50/50 dark:bg-emerald-900/20 p-2 rounded border border-emerald-100 dark:border-emerald-800/30 font-medium">
                                          {String(newData[field]) || "(empty)"}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            );
                          }
                        } catch (e) {}
                      }
                      
                      return (
                        <>
                          {selectedLog.old_value && (
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Original Data</span>
                              <pre className="text-xs bg-slate-900 dark:bg-black text-slate-100 p-4 rounded-lg overflow-x-auto font-mono">
                                {(() => {
                                  try {
                                    return JSON.stringify(JSON.parse(selectedLog.old_value), null, 2);
                                  } catch (e) {
                                    return selectedLog.old_value;
                                  }
                                })()}
                              </pre>
                            </div>
                          )}
                          {selectedLog.new_value && (
                            <div className="space-y-1">
                              <span className="text-[10px] font-bold text-emerald-500 dark:text-emerald-400 uppercase tracking-wider">Updated Data</span>
                              <pre className="text-xs bg-slate-900 dark:bg-black text-emerald-50 dark:text-emerald-200 p-4 rounded-lg overflow-x-auto font-mono border-l-4 border-emerald-500">
                                {(() => {
                                  try {
                                    return JSON.stringify(JSON.parse(selectedLog.new_value), null, 2);
                                  } catch (e) {
                                    return selectedLog.new_value;
                                  }
                                })()}
                              </pre>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AuditLogPage;
