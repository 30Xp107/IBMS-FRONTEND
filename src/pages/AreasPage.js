import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Trash2, MapPin, Building, Home, ArrowUpDown, ArrowUp, ArrowDown, Search, Globe } from "lucide-react";

const AreasPage = () => {
  const { api } = useAuth();
  const [areas, setAreas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "code", direction: "asc" });
  const [currentPage, setCurrentPage] = useState(1);
  const [totalAreas, setTotalAreas] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 10;

  useEffect(() => {
    fetchAreas();
  }, [currentPage, typeFilter, search, sortConfig]);

  const handleSort = (key) => {
    setSortConfig((prev) => {
      const direction = prev.key === key && prev.direction === "asc" ? "desc" : "asc";
      return { key, direction };
    });
    setCurrentPage(1);
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return <ArrowUpDown className="w-3 h-3 ml-1" />;
    return sortConfig.direction === "asc" ? <ArrowUp className="w-3 h-3 ml-1" /> : <ArrowDown className="w-3 h-3 ml-1" />;
  };

  const fetchAreas = async () => {
    setIsLoading(true);
    try {
      let query = `?page=${currentPage}&limit=${limit}`;
      if (typeFilter) query += `&type=${typeFilter}`;
      if (search) query += `&search=${search}`;
      if (sortConfig.key) {
        query += `&sort=${sortConfig.key}&order=${sortConfig.direction}`;
      }

      const response = await api.get(`/areas${query}`);
      const data = response.data;
      
      const normalizedData = (data.areas || []).map((area) => {
        const parentObj = area.parent_id && typeof area.parent_id === "object" ? area.parent_id : null;
        return {
          ...area,
          id: String(area._id || area.id),
          type: area.type?.toLowerCase(),
          parent_id_raw: area.parent_id, // Keep raw for reference if needed
          parent_id: parentObj ? String(parentObj._id || parentObj.id) : (area.parent_id ? String(area.parent_id) : ""),
          parent_name: parentObj ? parentObj.name : "",
          parent_code: area.parent_code || (parentObj ? parentObj.code : "")
        };
      });
      
      setAreas(normalizedData);
      setTotalAreas(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      toast.error("Failed to load areas");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setCurrentPage(1);
  };

  const handleTypeChange = (val) => {
    setTypeFilter(val === "all" ? "" : val);
    setCurrentPage(1);
  };

  const handleDelete = async (areaId) => {
    if (!window.confirm("Are you sure you want to delete this area?")) return;
    try {
      await api.delete(`/areas/${areaId}`);
      toast.success("Area deleted");
      fetchAreas();
    } catch (error) {
      toast.error("Failed to delete area");
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case "region":
        return <Globe className="w-4 h-4" />;
      case "province":
        return <Building className="w-4 h-4" />;
      case "municipality":
        return <MapPin className="w-4 h-4" />;
      case "barangay":
        return <Home className="w-4 h-4" />;
      default:
        return <MapPin className="w-4 h-4" />;
    }
  };

  const getTypeBadgeColor = (type) => {
    switch (type) {
      case "region":
        return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800";
      case "province":
        return "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-400 dark:border-violet-800";
      case "municipality":
        return "bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800";
      case "barangay":
        return "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/30 dark:text-slate-400 dark:border-slate-700";
    }
  };

  const getParentName = (area) => {
    if (!area.parent_id && !area.parent_code) return "-";
    
    let parentName = area.parent_name || "-";
    
    if (parentName === "-") {
      const parent = areas.find((a) => a.id === area.parent_id || a.code === area.parent_code);
      if (parent) parentName = parent.name;
    }

    const code = area.parent_code;
    return parentName + (code ? ` (${code})` : "");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Area Management</h1>
          <p className="text-slate-500 dark:text-slate-400">Philippine Standard Geographic Code (PSGC) Hierarchy</p>
        </div>
      </div>

      {/* Filter */}
      <Card className="border-stone-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search by area name..."
                value={search}
                onChange={handleSearchChange}
                className="pl-10 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200"
              />
            </div>
            <Select value={typeFilter || "all"} onValueChange={handleTypeChange}>
              <SelectTrigger className="w-full sm:w-48 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent className="dark:bg-slate-900 dark:border-slate-800">
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="region">Region</SelectItem>
                <SelectItem value="province">Province</SelectItem>
                <SelectItem value="municipality">City/Municipality</SelectItem>
                <SelectItem value="barangay">Barangay</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-stone-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-emerald-600" />
            Areas ({totalAreas})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="spinner" />
            </div>
          ) : areas.length === 0 ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              <MapPin className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No areas found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-stone-100 dark:bg-slate-800/50 hover:bg-stone-100 dark:hover:bg-slate-800/50 border-b dark:border-slate-800">
                      <TableHead 
                        className="font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                        onClick={() => handleSort("code")}
                      >
                        <div className="flex items-center">
                          PSGC Code {getSortIcon("code")}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                        onClick={() => handleSort("name")}
                      >
                        <div className="flex items-center">
                          Area Name {getSortIcon("name")}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                        onClick={() => handleSort("type")}
                      >
                        <div className="flex items-center">
                          Type {getSortIcon("type")}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                        onClick={() => handleSort("parent_id")}
                      >
                        <div className="flex items-center">
                          Parent Area {getSortIcon("parent_id")}
                        </div>
                      </TableHead>
                    <TableHead 
                      className="font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                      onClick={() => handleSort("createdAt")}
                    >
                      <div className="flex items-center">
                        Created At {getSortIcon("createdAt")}
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-slate-600 dark:text-slate-300 text-right pr-6">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                  {areas.map((area) => (
                    <TableRow key={area.id} className="border-b dark:border-slate-800 hover:bg-stone-50 dark:hover:bg-slate-800/30">
                      <TableCell className="font-mono text-xs dark:text-slate-400">{area.code}</TableCell>
                      <TableCell className="font-medium dark:text-slate-200">{area.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getTypeBadgeColor(area.type)}>
                          {getTypeIcon(area.type)}
                          <span className="ml-1 capitalize">{area.type}</span>
                        </Badge>
                      </TableCell>
                      <TableCell className="dark:text-slate-300">{getParentName(area)}</TableCell>
                      <TableCell className="text-slate-500 dark:text-slate-400">
                        {new Date(area.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/20"
                          onClick={() => handleDelete(area.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {/* Pagination */}
              <div className="flex flex-col sm:flex-row items-center justify-between px-4 py-4 border-t dark:border-slate-800 gap-4">
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  Showing <span className="font-medium text-slate-700 dark:text-slate-300">{(currentPage - 1) * limit + 1}</span> to <span className="font-medium text-slate-700 dark:text-slate-300">{Math.min(currentPage * limit, totalAreas)}</span> of <span className="font-medium text-slate-700 dark:text-slate-300">{totalAreas}</span> areas
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1 || isLoading}
                    className="dark:border-slate-700"
                  >
                    Previous
                  </Button>
                  <div className="flex items-center gap-1 mx-2">
                    <span className="text-sm text-slate-500">Page</span>
                    <span className="text-sm font-medium">{currentPage}</span>
                    <span className="text-sm text-slate-500">of {totalPages}</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages || isLoading}
                    className="dark:border-slate-700"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AreasPage;
