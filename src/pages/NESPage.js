import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { areaCache } from "@/lib/utils";
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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Search, Edit, Trash2, FileText, CheckCircle, XCircle, Download, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import * as XLSX from "xlsx";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const NESPage = () => {
  const { api, isAdmin } = useAuth();
  const [nesRecords, setNesRecords] = useState([]);
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [areas, setAreas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  
  const [frmSchedules, setFrmSchedules] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState("");
  
  const [regionFilter, setRegionFilter] = useState("all");
  const [provinceFilter, setProvinceFilter] = useState("all");
  const [municipalityFilter, setMunicipalityFilter] = useState("all");
  const [barangayFilter, setBarangayFilter] = useState("all");
  
  const [attendanceFilter, setAttendanceFilter] = useState("all");
  const [sortConfig, setSortConfig] = useState({ key: "last_name", direction: "asc" });
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalBeneficiaries, setTotalBeneficiaries] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

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
  }, [debouncedSearch, regionFilter, provinceFilter, municipalityFilter, barangayFilter, attendanceFilter, itemsPerPage]);

  useEffect(() => {
    fetchFrmSchedules();
  }, []);

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
          // Fallback to latest schedule if none matches current date
          const sorted = [...schedules].sort((a, b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());
          setSelectedPeriod(sorted[0].name);
        } else {
          // Fallback to monthly format if no schedules defined
          const fallback = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
          setSelectedPeriod(fallback);
        }
      } else {
        // Fallback to monthly format if no config
        const now = new Date();
        setSelectedPeriod(`${MONTHS[now.getMonth()]} ${now.getFullYear()}`);
      }
    } catch (error) {
      console.error("Failed to fetch FRM schedules:", error);
      const now = new Date();
      setSelectedPeriod(`${MONTHS[now.getMonth()]} ${now.getFullYear()}`);
    }
  };

  useEffect(() => {
    if (selectedPeriod) {
      fetchData();
    }
  }, [currentPage, debouncedSearch, selectedPeriod, attendanceFilter, regionFilter, provinceFilter, municipalityFilter, barangayFilter, sortConfig, itemsPerPage]);

  useEffect(() => {
    fetchAreas("region");
  }, []);

  const fetchAreas = async (type = null, parentId = null, parentCode = null) => {
    try {
      // Don't fetch if all are null to avoid loading all 40,000+ areas
      if (!type && !parentId && !parentCode) return;

      const cacheKey = `areas-${type || 'all'}-${parentId || 'none'}-${parentCode || 'none'}`;
      const cachedData = areaCache.get(cacheKey);
      
      if (cachedData) {
        setAreas(prev => {
          const existingIds = new Set(prev.map(a => a.id));
          const newData = cachedData.filter(a => !existingIds.has(a.id));
          return [...prev, ...newData];
        });
        return cachedData;
      }

      let query = `?limit=500`; // Use a large enough limit for any single level
      if (type) query += `&type=${type}`;
      if (parentId) query += `&parent_id=${parentId}`;
      if (parentCode) query += `&parent_code=${parentCode}`;

      const response = await api.get(`/areas${query}`);
      // Handle both paginated and non-paginated responses
      const data = Array.isArray(response.data) ? response.data : (response.data.areas || []);
      
      const normalizedData = data.map((area) => ({
        ...area,
        id: String(area._id || area.id),
        type: area.type?.toLowerCase(),
        parent_id: area.parent_id ? (typeof area.parent_id === "object" ? String(area.parent_id?._id || area.parent_id?.id) : String(area.parent_id)) : ""
      }));
      
      areaCache.set(cacheKey, normalizedData);

      setAreas(prev => {
        const existingIds = new Set(prev.map(a => a.id));
        const newData = normalizedData.filter(a => !existingIds.has(a.id));
        return [...prev, ...newData];
      });
    } catch (error) {
      console.error("Failed to load areas");
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

  const fetchData = async () => {
    setIsLoading(true);
    try {
      let benQuery = `?page=${currentPage}&limit=${itemsPerPage}&sort=${sortConfig.key}&order=${sortConfig.direction}&status=Active`;
      if (debouncedSearch) benQuery += `&search=${encodeURIComponent(debouncedSearch)}`;
      if (regionFilter !== "all") benQuery += `&region=${encodeURIComponent(regionFilter)}`;
      if (provinceFilter !== "all") benQuery += `&province=${encodeURIComponent(provinceFilter)}`;
      if (municipalityFilter !== "all") benQuery += `&municipality=${encodeURIComponent(municipalityFilter)}`;
      if (barangayFilter !== "all") benQuery += `&barangay=${encodeURIComponent(barangayFilter)}`;

      const [benResponse] = await Promise.all([
        api.get(`/beneficiaries${benQuery}`)
      ]);
      
      const benData = benResponse.data;
      const benList = benData.beneficiaries || [];
      const benIds = benList.map(b => String(b._id || b.id));
      
      setBeneficiaries(benList.map(b => ({
        ...b,
        id: String(b._id || b.id)
      })));
      
      setTotalBeneficiaries(benData.total || 0);
      setTotalPages(benData.totalPages || 1);
      
      // Now fetch NES records only for these beneficiaries
      if (benIds.length > 0) {
        const nesResponse = await api.get(`/nes?frm_period=${encodeURIComponent(selectedPeriod)}&beneficiary_ids=${benIds.join(",")}`);
        const nesData = Array.isArray(nesResponse.data) ? nesResponse.data : (nesResponse.data.nesRecords || []);
        setNesRecords(nesData.map(r => ({
          ...r,
          id: String(r._id || r.id),
          beneficiary_id: r.beneficiary_id ? (typeof r.beneficiary_id === "object" ? String(r.beneficiary_id?._id || r.beneficiary_id?.id) : String(r.beneficiary_id)) : ""
        })));
      } else {
        setNesRecords([]);
      }
    } catch (error) {
      toast.error("Failed to load data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async (beneficiary, field, value) => {
    // Optimistic update for local state
    const currentNes = nesRecords.find(r => r.beneficiary_id === beneficiary.id);
    
    if (field === "attendance" && value === "none") {
      if (currentNes && currentNes.id) {
        try {
          await api.delete(`/nes/${currentNes.id}`);
          setNesRecords(prev => prev.filter(r => r.beneficiary_id !== beneficiary.id));
          toast.success("Record cleared");
        } catch (error) {
          toast.error("Failed to clear record");
        }
      }
      return;
    }

    // Optimistically update the status if it's an attendance change
    if (field === "attendance") {
      setNesRecords(prev => {
        const exists = prev.some(r => r.beneficiary_id === beneficiary.id);
        if (exists) {
          return prev.map(r => r.beneficiary_id === beneficiary.id ? { ...r, attendance: value } : r);
        } else {
          return [...prev, {
            beneficiary_id: beneficiary.id,
            hhid: beneficiary.hhid,
            frm_period: selectedPeriod,
            attendance: value,
            reason: "",
            date_recorded: new Date().toISOString().split("T")[0]
          }];
        }
      });
    }

    try {
      const updateData = {
        beneficiary_id: beneficiary.id,
        hhid: beneficiary.hhid,
        frm_period: selectedPeriod,
        attendance: field === "attendance" ? value : (currentNes?.attendance || "none"),
        reason: field === "reason" ? value : (currentNes?.reason || ""),
        action: field === "action" ? value : (currentNes?.action || ""),
        date_recorded: new Date().toISOString().split("T")[0],
      };

      const response = await api.post("/nes/upsert", updateData);
      
      // Normalize response ID
      const updatedNes = {
        ...response.data,
        id: String(response.data._id || response.data.id),
        beneficiary_id: response.data.beneficiary_id 
          ? (typeof response.data.beneficiary_id === "object" 
            ? String(response.data.beneficiary_id?._id || response.data.beneficiary_id?.id) 
            : String(response.data.beneficiary_id))
          : ""
      };
      
      // Update local state with the actual data from server
      setNesRecords(prev => {
        const index = prev.findIndex(r => r.beneficiary_id === beneficiary.id);
        if (index > -1) {
          const newRecords = [...prev];
          newRecords[index] = updatedNes;
          return newRecords;
        }
        return [...prev, updatedNes];
      });

      if (field === "attendance") {
        toast.success(`Status updated for ${beneficiary.last_name}`);
      } else if (field === "action") {
        toast.success(`Action updated for ${beneficiary.last_name}`);
      } else {
        toast.success("Record updated");
      }
    } catch (error) {
      console.error("Update error:", error);
      toast.error("Failed to update record");
      // On error, refresh data to revert optimistic changes
      fetchData();
    }
  };

  const handleExport = async () => {
    try {
      const toastId = toast.loading("Preparing export...");
      
      // Fetch all beneficiaries for the current filter
      let benQuery = `?limit=all&status=Active&sort=${sortConfig.key}&order=${sortConfig.direction}`;
      if (debouncedSearch) benQuery += `&search=${encodeURIComponent(debouncedSearch)}`;
      if (regionFilter !== "all") benQuery += `&region=${encodeURIComponent(regionFilter)}`;
      if (provinceFilter !== "all") benQuery += `&province=${encodeURIComponent(provinceFilter)}`;
      if (municipalityFilter !== "all") benQuery += `&municipality=${encodeURIComponent(municipalityFilter)}`;
      if (barangayFilter !== "all") benQuery += `&barangay=${encodeURIComponent(barangayFilter)}`;

      const benResponse = await api.get(`/beneficiaries${benQuery}`);
      const allBeneficiaries = (benResponse.data.beneficiaries || []).map(b => ({
        ...b,
        id: String(b._id || b.id)
      }));

      if (allBeneficiaries.length === 0) {
        toast.dismiss(toastId);
        toast.error("No data to export");
        return;
      }

      // Fetch all NES records for the current FRM period
      const nesResponse = await api.get(`/nes?limit=all&frm_period=${encodeURIComponent(selectedPeriod)}`);
      const allNesRecords = (Array.isArray(nesResponse.data) ? nesResponse.data : (nesResponse.data.nesRecords || [])).map(r => ({
        ...r,
        beneficiary_id: r.beneficiary_id ? (typeof r.beneficiary_id === "object" ? String(r.beneficiary_id?._id || r.beneficiary_id?.id) : String(r.beneficiary_id)) : ""
      }));

      const exportData = allBeneficiaries.map(b => {
        const nes = allNesRecords.find(r => r.beneficiary_id === b.id);
        return {
          "HHID": b.hhid,
          "Last Name": b.last_name,
          "First Name": b.first_name,
          "Region": b.region,
          "Province": b.province,
          "Municipality": b.municipality,
          "Barangay": b.barangay,
          "FRM Period": selectedPeriod,
          "Attendance": nes?.attendance || "none",
          "Reason": nes?.reason || "",
          "Date Recorded": nes?.date_recorded || ""
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "NES Records");
      
      const wscols = [
        { wch: 15 }, // HHID
        { wch: 20 }, // Last Name
        { wch: 20 }, // First Name
        { wch: 20 }, // Region
        { wch: 20 }, // Province
        { wch: 20 }, // Municipality
        { wch: 20 }, // Barangay
        { wch: 20 }, // FRM Period
        { wch: 15 }, // Attendance
        { wch: 30 }, // Reason
        { wch: 15 }, // Date Recorded
      ];
      worksheet["!cols"] = wscols;

      XLSX.writeFile(workbook, `nes_records_${selectedPeriod.replace(/\s+/g, "_")}_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.dismiss(toastId);
      toast.success(`Exported ${allBeneficiaries.length} records`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export data");
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [search, attendanceFilter, sortConfig]);

  // No longer using client-side sorting as we now fetch sorted data from server
  const sortedBeneficiaries = beneficiaries;

  const filteredBeneficiaries = sortedBeneficiaries.filter(b => {
    if (attendanceFilter === "all") return true;
    
    const nes = nesRecords.find(r => r.beneficiary_id === b.id);
    const status = nes?.attendance || "none";
    
    return status === attendanceFilter;
  });

  const currentItems = filteredBeneficiaries;

  const currentYear = new Date().getFullYear();
  const years = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2, currentYear - 3];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="text-center sm:text-left">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100">Nutrition Education Sessions (NES)</h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Track and manage NES attendance records</p>
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

      {/* Filters */}
      <Card className="border-stone-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search by HHID or Name..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-10 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="whitespace-nowrap dark:text-slate-300">FRM Period:</Label>
                <Select value={selectedPeriod} onValueChange={(v) => {
                  setSelectedPeriod(v);
                  setCurrentPage(1);
                }}>
                  <SelectTrigger className="w-full sm:w-48 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200">
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

            <div className="flex flex-wrap items-center gap-2">
              <Select value={attendanceFilter} onValueChange={(v) => {
                setAttendanceFilter(v);
                setCurrentPage(1);
              }}>
                <SelectTrigger className="w-full sm:w-40 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="dark:bg-slate-900 dark:border-slate-800">
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                  <SelectItem value="none">Not Recorded</SelectItem>
                </SelectContent>
              </Select>

              <Select value={regionFilter} onValueChange={(val) => {
                setRegionFilter(val);
                setProvinceFilter("all");
                setMunicipalityFilter("all");
                setBarangayFilter("all");
                setCurrentPage(1);
                const regionObj = areas.find(a => a.name?.trim().toLowerCase() === val?.trim().toLowerCase() && a.type === "region");
                if (regionObj) fetchAreas("province", regionObj.id, regionObj.code);
              }}>
                <SelectTrigger className="w-full sm:w-40 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200">
                  <SelectValue placeholder="Region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Regions</SelectItem>
                  {areas.filter(a => a.type === "region").map(r => (
                    <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select 
                value={provinceFilter} 
                onValueChange={(val) => {
                  setProvinceFilter(val);
                  setMunicipalityFilter("all");
                  setBarangayFilter("all");
                  setCurrentPage(1);
                  const regionObj = areas.find(a => a.name?.trim().toLowerCase() === regionFilter?.trim().toLowerCase() && a.type === "region");
                  const provinceObj = areas.find(a => a.name?.trim().toLowerCase() === val?.trim().toLowerCase() && a.type === "province" && (regionObj ? (a.parent_id === regionObj.id || a.parent_code === regionObj.code) : true));
                  if (provinceObj) fetchAreas("municipality", provinceObj.id, provinceObj.code);
                }}
                disabled={regionFilter === "all"}
              >
                <SelectTrigger className="w-full sm:w-40 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200">
                  <SelectValue placeholder="Province" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Provinces</SelectItem>
                  {areas.filter(a => a.type === "province" && (regionFilter !== "all" ? a.parent_id === areas.find(r => r.name === regionFilter)?.id : true)).map(p => (
                    <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select 
                value={municipalityFilter} 
                onValueChange={(val) => {
                  setMunicipalityFilter(val);
                  setBarangayFilter("all");
                  setCurrentPage(1);
                  const regionObj = areas.find(a => a.name?.trim().toLowerCase() === regionFilter?.trim().toLowerCase() && a.type === "region");
                  const provinceObj = areas.find(a => a.name?.trim().toLowerCase() === provinceFilter?.trim().toLowerCase() && a.type === "province" && (regionObj ? (a.parent_id === regionObj.id || a.parent_code === regionObj.code) : true));
                  const municipalityObj = areas.find(a => a.name?.trim().toLowerCase() === val?.trim().toLowerCase() && a.type === "municipality" && (provinceObj ? (a.parent_id === provinceObj.id || a.parent_code === provinceObj.code) : true));
                  if (municipalityObj) fetchAreas("barangay", municipalityObj.id, municipalityObj.code);
                }}
                disabled={provinceFilter === "all"}
              >
                <SelectTrigger className="w-full sm:w-40 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200">
                  <SelectValue placeholder="Municipality" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Municipalities</SelectItem>
                  {areas.filter(a => a.type === "municipality" && (provinceFilter !== "all" ? a.parent_id === areas.find(p => p.name === provinceFilter)?.id : true)).map(m => (
                    <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select 
                value={barangayFilter} 
                onValueChange={(val) => {
                  setBarangayFilter(val);
                  setCurrentPage(1);
                }}
                disabled={municipalityFilter === "all"}
              >
                <SelectTrigger className="w-full sm:w-40 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200">
                  <SelectValue placeholder="Barangay" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Barangays</SelectItem>
                  {areas.filter(a => a.type === "barangay" && (municipalityFilter !== "all" ? a.parent_id === areas.find(m => m.name === municipalityFilter)?.id : true)).map(b => (
                    <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={itemsPerPage.toString()} onValueChange={(v) => setItemsPerPage(v === "all" ? "all" : parseInt(v))}>
                <SelectTrigger className="w-full sm:w-32 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200">
                  <SelectValue placeholder="Rows" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 rows</SelectItem>
                  <SelectItem value="20">20 rows</SelectItem>
                  <SelectItem value="50">50 rows</SelectItem>
                  <SelectItem value="100">100 rows</SelectItem>
                  <SelectItem value="all">Show All</SelectItem>
                </SelectContent>
              </Select>

              {(regionFilter !== "all" || provinceFilter !== "all" || municipalityFilter !== "all" || barangayFilter !== "all" || attendanceFilter !== "all") && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setRegionFilter("all");
                    setProvinceFilter("all");
                    setMunicipalityFilter("all");
                    setBarangayFilter("all");
                    setAttendanceFilter("all");
                    setCurrentPage(1);
                  }}
                  className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-stone-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="pb-3 border-b dark:border-slate-800">
          <CardTitle className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-500" />
            NES Records ({totalBeneficiaries})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && filteredBeneficiaries.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
            </div>
          ) : filteredBeneficiaries.length === 0 ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No beneficiaries found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-stone-100 dark:bg-slate-800/50 hover:bg-stone-100 dark:hover:bg-slate-800/50 border-b dark:border-slate-800">
                    <TableHead 
                      className="font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-left pl-6 hidden sm:table-cell"
                      onClick={() => handleSort("hhid")}
                    >
                      <div className="flex items-center justify-start">
                        HHID {getSortIcon("hhid")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-left sm:text-center"
                      onClick={() => handleSort("last_name")}
                    >
                      <div className="flex items-center justify-start sm:justify-center">
                        Beneficiary {getSortIcon("last_name")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-center hidden lg:table-cell"
                      onClick={() => handleSort("barangay")}
                    >
                      <div className="flex items-center justify-center">
                        Barangay {getSortIcon("barangay")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-center hidden xl:table-cell"
                      onClick={() => handleSort("municipality")}
                    >
                      <div className="flex items-center justify-center">
                        Municipality {getSortIcon("municipality")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-center hidden xl:table-cell"
                      onClick={() => handleSort("province")}
                    >
                      <div className="flex items-center justify-center">
                        Province {getSortIcon("province")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-center"
                      onClick={() => handleSort("attendance")}
                    >
                      <div className="flex items-center justify-center">
                        Attendance {getSortIcon("attendance")}
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-slate-600 dark:text-slate-300 text-center hidden md:table-cell">Reason</TableHead>
                    <TableHead className="font-semibold text-slate-600 dark:text-slate-300 text-center hidden sm:table-cell">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentItems.map((b) => {
                    const nes = nesRecords.find(r => r.beneficiary_id === b.id);
                    return (
                      <TableRow key={b.id} className="border-b dark:border-slate-800 hover:bg-stone-50 dark:hover:bg-slate-800/30">
                        <TableCell className="font-mono text-sm dark:text-slate-300 text-left pl-6 hidden sm:table-cell">{b.hhid}</TableCell>
                        <TableCell className="dark:text-slate-300 text-left sm:text-center">
                          <div className="flex flex-col sm:items-center">
                            <span className="font-medium">{b.last_name}, {b.first_name}</span>
                            <span className="text-[10px] text-slate-500 sm:hidden">{b.hhid}</span>
                          </div>
                        </TableCell>
                        <TableCell className="dark:text-slate-300 text-center hidden lg:table-cell">{b.barangay}</TableCell>
                        <TableCell className="dark:text-slate-300 text-center hidden xl:table-cell">{b.municipality}</TableCell>
                        <TableCell className="dark:text-slate-300 text-center hidden xl:table-cell">{b.province}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center">
                            <Select
                              value={nes?.attendance || "none"}
                              onValueChange={(val) => handleUpdate(b, "attendance", val)}
                            >
                              <SelectTrigger className={`w-28 sm:w-32 h-8 text-[10px] sm:text-xs ${
                                nes?.attendance === "present" 
                                  ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800" 
                                  : nes?.attendance === "absent"
                                  ? "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800"
                                  : "dark:bg-slate-900 dark:border-slate-700"
                              }`}>
                                <SelectValue placeholder="Status" />
                              </SelectTrigger>
                              <SelectContent className="dark:bg-slate-900 dark:border-slate-800">
                                <SelectItem value="none">Not Recorded</SelectItem>
                                <SelectItem value="present">Present</SelectItem>
                                <SelectItem value="absent">Absent</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </TableCell>
                        <TableCell className="text-center hidden md:table-cell">
                          <Input
                            placeholder="Reason..."
                            value={nes?.reason || ""}
                            onChange={(e) => {
                              const newVal = e.target.value;
                              setNesRecords(prev => {
                                const exists = prev.some(r => r.beneficiary_id === b.id);
                                if (exists) {
                                  return prev.map(r => r.beneficiary_id === b.id ? { ...r, reason: newVal } : r);
                                } else {
                                  return [...prev, { 
                                    beneficiary_id: b.id, 
                                    hhid: b.hhid,
                                    frm_period: selectedPeriod,
                                    attendance: "none",
                                    reason: newVal,
                                    date_recorded: new Date().toISOString().split("T")[0]
                                  }];
                                }
                              });
                            }}
                            onBlur={(e) => handleUpdate(b, "reason", e.target.value)}
                            disabled={nes?.attendance !== "absent"}
                            className="h-8 text-xs dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200 text-center"
                          />
                        </TableCell>
                        <TableCell className="text-center hidden sm:table-cell">
                          <div className="flex items-center justify-center gap-1 text-[10px] sm:text-xs">
                            {nes && (nes.attendance === "present" || (nes.attendance === "absent" && nes.reason)) ? (
                              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-500">
                                <CheckCircle className="w-3 h-3" />
                                <span className="hidden lg:inline">Saved</span>
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-slate-400 dark:text-slate-500">
                                <XCircle className="w-3 h-3" />
                                <span className="hidden lg:inline">Pending</span>
                              </span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage === 1}
            className="dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Previous
          </Button>
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
                    : "dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                  }`}
                >
                  {page}
                </Button>
              )}
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
};

export default NESPage;
