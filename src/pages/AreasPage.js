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
import { Plus, Trash2, MapPin, Building, Home, ArrowUpDown, ArrowUp, ArrowDown, Search, Globe, ChevronLeft, ChevronRight } from "lucide-react";

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
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [debouncedSearch, setDebouncedSearch] = useState(search);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset to page 1 when filters or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, typeFilter, itemsPerPage]);

  useEffect(() => {
    fetchAreas();
  }, [currentPage, typeFilter, debouncedSearch, sortConfig, itemsPerPage]);

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

  const fetchAreas = async () => {
    setIsLoading(true);
    try {
      let query = `?page=${currentPage}&limit=${itemsPerPage}`;
      if (typeFilter) query += `&type=${typeFilter}`;
      if (debouncedSearch) query += `&search=${encodeURIComponent(debouncedSearch)}`;
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
            <div className="flex flex-col sm:flex-row gap-4 items-center">
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
              <Select value={itemsPerPage.toString()} onValueChange={(v) => setItemsPerPage(v === "all" ? "all" : parseInt(v))}>
                <SelectTrigger className="w-full sm:w-32 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200">
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
          {isLoading && areas.length === 0 ? (
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
                        className="font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-left pl-6 hidden md:table-cell"
                        onClick={() => handleSort("code")}
                      >
                        <div className="flex items-center justify-start">
                          PSGC Code {getSortIcon("code")}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-center"
                        onClick={() => handleSort("name")}
                      >
                        <div className="flex items-center justify-center">
                          Area Name {getSortIcon("name")}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-center hidden sm:table-cell"
                        onClick={() => handleSort("type")}
                      >
                        <div className="flex items-center justify-center">
                          Type {getSortIcon("type")}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-center hidden lg:table-cell"
                        onClick={() => handleSort("parent_id")}
                      >
                        <div className="flex items-center justify-center">
                          Parent Area {getSortIcon("parent_id")}
                        </div>
                      </TableHead>
                    <TableHead 
                      className="font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-center hidden xl:table-cell"
                      onClick={() => handleSort("createdAt")}
                    >
                      <div className="flex items-center justify-center">
                        Created At {getSortIcon("createdAt")}
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-slate-600 dark:text-slate-300 text-center">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                  {areas.map((area) => (
                    <TableRow key={area.id} className="border-b dark:border-slate-800 hover:bg-stone-50 dark:hover:bg-slate-800/30">
                      <TableCell className="font-mono text-xs dark:text-slate-400 text-left pl-6 hidden md:table-cell">{area.code}</TableCell>
                      <TableCell className="font-medium dark:text-slate-200 text-center">{area.name}</TableCell>
                      <TableCell className="text-center hidden sm:table-cell">
                        <div className="flex justify-center">
                          <Badge variant="outline" className={getTypeBadgeColor(area.type)}>
                            {getTypeIcon(area.type)}
                            <span className="ml-1 capitalize">{area.type}</span>
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="dark:text-slate-300 text-center hidden lg:table-cell">{getParentName(area)}</TableCell>
                      <TableCell className="text-slate-500 dark:text-slate-400 text-center hidden xl:table-cell">
                        {new Date(area.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/20"
                            onClick={() => handleDelete(area.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {/* Pagination */}
              {totalAreas > 0 && (
                <div className="px-6 py-4 border-t dark:border-slate-800 bg-stone-50/50 dark:bg-slate-800/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                    {itemsPerPage === "all" ? (
                      <span>Showing all <span className="font-medium text-slate-700 dark:text-slate-200">{totalAreas}</span> areas</span>
                    ) : (
                      <>
                        Showing <span className="font-medium text-slate-700 dark:text-slate-200">{(currentPage - 1) * itemsPerPage + 1}</span> to{" "}
                        <span className="font-medium text-slate-700 dark:text-slate-200">{Math.min(currentPage * itemsPerPage, totalAreas)}</span> of{" "}
                        <span className="font-medium text-slate-700 dark:text-slate-200">{totalAreas}</span> areas
                      </>
                    )}
                  </div>

                  {itemsPerPage !== "all" && totalPages > 1 && (
                    <div className="flex items-center gap-1 sm:gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 dark:bg-slate-900 dark:border-slate-700"
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>

                      <div className="flex items-center gap-1">
                        {getPaginationRange().map((page, index) => (
                          <div key={index} className="flex items-center gap-1">
                            {page === "..." ? (
                              <span className="px-2 text-slate-400 dark:text-slate-600">...</span>
                            ) : (
                              <Button
                                variant={currentPage === page ? "default" : "outline"}
                                size="sm"
                                onClick={() => setCurrentPage(page)}
                                className={`h-8 w-8 text-xs p-0 ${
                                  currentPage === page 
                                  ? "bg-emerald-600 hover:bg-emerald-700 text-white" 
                                  : "dark:bg-slate-900 dark:border-slate-700"
                                }`}
                              >
                                {page}
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>

                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 dark:bg-slate-900 dark:border-slate-700"
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AreasPage;
