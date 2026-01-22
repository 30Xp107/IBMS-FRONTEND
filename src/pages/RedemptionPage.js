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
import { toast } from "sonner";
import { Search, Edit, CheckCircle, XCircle, Download, ArrowUpDown, ArrowUp, ArrowDown, FileText } from "lucide-react";
import * as XLSX from "xlsx";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const RedemptionPage = () => {
  const { api, isAdmin } = useAuth();
  const [redemptions, setRedemptions] = useState([]);
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  
  const [frmSchedules, setFrmSchedules] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState("");
  
  const [attendanceFilter, setAttendanceFilter] = useState("all");
  
  // Area filters
  const [areas, setAreas] = useState([]);
  const [regionFilter, setRegionFilter] = useState("all");
  const [provinceFilter, setProvinceFilter] = useState("all");
  const [municipalityFilter, setMunicipalityFilter] = useState("all");
  const [barangayFilter, setBarangayFilter] = useState("all");

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, debouncedSearch, selectedPeriod, attendanceFilter, regionFilter, provinceFilter, municipalityFilter, barangayFilter, sortConfig, itemsPerPage]);

  useEffect(() => {
    fetchAreas("region");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAreas = async (type = null, parentId = null, parentCode = null) => {
    try {
      // Don't fetch if all are null to avoid loading all 40,000+ areas
      if (!type && !parentId && !parentCode) return;

      const cacheKey = `areas-${type || 'all'}-${parentId || 'none'}-${parentCode || 'none'}`;
      const cachedData = areaCache.get(cacheKey);
      
      if (cachedData) {
        setAreas(prev => {
          const existingIds = new Set((prev || []).filter(a => a).map(a => a.id));
          const newData = cachedData.filter(a => a && !existingIds.has(a.id));
          return [...(prev || []), ...newData];
        });
        return cachedData;
      }

      let query = `?limit=500`; // Use a large enough limit for any single level
      if (type) query += `&type=${type}`;
      if (parentId) query += `&parent_id=${parentId}`;
      if (parentCode) query += `&parent_code=${parentCode}`;

      const response = await api.get(`/areas${query}`);
      const data = Array.isArray(response.data) ? response.data : (response.data.areas || []);
      
      const normalizedData = data.filter(area => area).map((area) => ({
        ...area,
        id: String(area._id || area.id || ""),
        type: (area.type || "").toLowerCase(),
        parent_id: area.parent_id ? (typeof area.parent_id === "object" ? String(area.parent_id?._id || area.parent_id?.id || "") : String(area.parent_id)) : ""
      }));
      
      areaCache.set(cacheKey, normalizedData);

      setAreas(prev => {
        const existingIds = new Set((prev || []).filter(a => a).map(a => a.id));
        const newData = normalizedData.filter(a => a && !existingIds.has(a.id));
        return [...(prev || []), ...newData];
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
      
      // Add redemption status filtering
      if (attendanceFilter !== "all") {
        benQuery += `&redemption_status=${attendanceFilter}`;
        benQuery += `&frm_period=${encodeURIComponent(selectedPeriod)}`;
      }

      const response = await api.get(`/beneficiaries${benQuery}`);
      const data = response.data;
      const benList = (data.beneficiaries || []).filter(b => b);
      const benIds = benList.map(b => String(b._id || b.id || ""));

      // Extract current redemptions from beneficiaries if provided by server
      const serverRedemptions = benList
        .filter(b => b.current_redemption)
        .map(b => ({
          ...b.current_redemption,
          id: String(b.current_redemption._id || b.current_redemption.id || ""),
          beneficiary_id: String(b._id || b.id || ""),
          type: b.current_redemption.type || 'redemption' // Default to redemption if not specified
        }));

      setBeneficiaries(benList.map(b => ({
              ...b,
              id: String(b._id || b.id || "")
            })));
            
            setTotalBeneficiaries(data.total || 0);
            setTotalPages(data.totalPages || 1);
            
            if (serverRedemptions.length > 0) {
              setRedemptions(serverRedemptions);
            } else if (benIds.length > 0) {
              const redResponse = await api.get(`/redemptions?limit=all&frm_period=${encodeURIComponent(selectedPeriod)}&beneficiary_ids=${benIds.join(",")}`);
              const redData = Array.isArray(redResponse.data) ? redResponse.data : (redResponse.data.redemptions || []);
              setRedemptions(redData.filter(r => r).map(r => ({
                ...r,
                id: String(r._id || r.id || ""),
                beneficiary_id: r.beneficiary_id ? (typeof r.beneficiary_id === "object" ? String(r.beneficiary_id?._id || r.beneficiary_id?.id || "") : String(r.beneficiary_id)) : ""
              })));
      } else {
        setRedemptions([]);
      }
    } catch (error) {
      toast.error("Failed to load data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async (beneficiary, field, value) => {
    if (!beneficiary || !beneficiary.id) return;
    
    // Optimistic update for local state
    const currentRedemption = redemptions.find(r => 
      r && (
        (r.beneficiary_id && r.beneficiary_id === beneficiary.id) || 
        (r.hhid && beneficiary.hhid && beneficiary.hhid !== "0" && beneficiary.hhid !== "" && r.hhid === beneficiary.hhid)
      )
    );
    
    if (field === "attendance" && value === "none") {
      if (currentRedemption && currentRedemption.id) {
        try {
          const endpoint = currentRedemption.type === 'nes' ? '/nes' : '/redemptions';
          await api.delete(`${endpoint}/${currentRedemption.id}`);
          setRedemptions(prev => prev.filter(r => 
            r.id !== currentRedemption.id && 
            r.beneficiary_id !== beneficiary.id
          ));
          toast.success("Record cleared");
        } catch (error) {
          console.error("Delete error:", error);
          const message = error.response?.data?.message || "Failed to clear record";
          toast.error(message);
        }
      }
      return;
    }

    // Optimistically update the status if it's an attendance or action change
    if (field === "attendance" || field === "action") {
      setRedemptions(prev => {
        const exists = prev.some(r => 
          (r.beneficiary_id && r.beneficiary_id === beneficiary.id) || 
          (r.hhid && beneficiary.hhid && beneficiary.hhid !== "0" && beneficiary.hhid !== "" && r.hhid === beneficiary.hhid)
        );
        if (exists) {
          return prev.map(r => {
            if ((r.beneficiary_id && r.beneficiary_id === beneficiary.id) || 
                (r.hhid && beneficiary.hhid && beneficiary.hhid !== "0" && beneficiary.hhid !== "" && r.hhid === beneficiary.hhid)) {
              // Clear action if attendance changes
              if (field === "attendance") {
                return { ...r, attendance: value, action: "" };
              }
              return { ...r, [field]: value };
            }
            return r;
          });
        } else {
          return [...prev, {
            beneficiary_id: beneficiary.id,
            hhid: beneficiary.hhid,
            frm_period: selectedPeriod,
            attendance: field === "attendance" ? value : "none",
            reason: "",
            action: field === "action" ? value : "",
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
        attendance: field === "attendance" ? value : (currentRedemption?.attendance || "none"),
        reason: field === "reason" ? value : (currentRedemption?.reason || ""),
        action: field === "attendance" ? "" : (field === "action" ? value : (currentRedemption?.action || "")),
        date_recorded: new Date().toISOString().split("T")[0],
      };

      const response = await api.post("/redemptions/upsert", updateData);
      
      // Normalize response ID
      const updatedRed = {
        ...response.data,
        id: String(response.data._id || response.data.id),
        beneficiary_id: response.data.beneficiary_id 
          ? (typeof response.data.beneficiary_id === "object" 
            ? String(response.data.beneficiary_id?._id || response.data.beneficiary_id?.id) 
            : String(response.data.beneficiary_id))
          : ""
      };
      
      // Update local state with the actual data from server
      setRedemptions(prev => {
        const index = prev.findIndex(r => r.beneficiary_id === beneficiary.id);
        if (index > -1) {
          const newRed = [...prev];
          newRed[index] = updatedRed;
          return newRed;
        }
        return [...prev, updatedRed];
      });

      if (field === "attendance") {
        toast.success("Status updated");
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
      
      // Fetch only what is showing in the table (current page and limit)
      let exportQuery = `?page=${currentPage}&limit=${itemsPerPage}&sort=${sortConfig.key}&order=${sortConfig.direction}&frm_period=${encodeURIComponent(selectedPeriod)}`;
      if (debouncedSearch) exportQuery += `&search=${encodeURIComponent(debouncedSearch)}`;
      if (regionFilter !== "all") exportQuery += `&region=${encodeURIComponent(regionFilter)}`;
      if (provinceFilter !== "all") exportQuery += `&province=${encodeURIComponent(provinceFilter)}`;
      if (municipalityFilter !== "all") exportQuery += `&municipality=${encodeURIComponent(municipalityFilter)}`;
      if (barangayFilter !== "all") exportQuery += `&barangay=${encodeURIComponent(barangayFilter)}`;
      if (attendanceFilter !== "all") exportQuery += `&redemption_status=${attendanceFilter}`;

      const response = await api.get(`/beneficiaries/export${exportQuery}`);
      const exportData = response.data.data;

      if (!exportData || exportData.length === 0) {
        toast.dismiss(toastId);
        toast.error("No data to export");
        return;
      }

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Redemptions");
      
      const wscols = [
        { wch: 15 }, // HHID
        { wch: 20 }, // Last Name
        { wch: 20 }, // First Name
        { wch: 20 }, // Middle Name
        { wch: 20 }, // Region
        { wch: 20 }, // Province
        { wch: 20 }, // Municipality
        { wch: 20 }, // Barangay
        { wch: 15 }, // Status
        { wch: 20 }, // FRM Period
        { wch: 20 }, // Redemption Status
        { wch: 20 }, // Redemption Rate (%)
        { wch: 20 }, // NES Attendance
        { wch: 15 }, // NES Rate (%)
        { wch: 25 }, // Remarks
        { wch: 30 }, // Reason
        { wch: 15 }, // Date Recorded
      ];
      worksheet["!cols"] = wscols;

      XLSX.writeFile(workbook, `redemptions_${selectedPeriod.replace(/\s+/g, "_")}_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.dismiss(toastId);
      toast.success(`Exported ${exportData.length} records`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export data");
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [search, attendanceFilter, sortConfig, regionFilter, provinceFilter, municipalityFilter, barangayFilter]);

  const getRegions = () => (areas || []).filter(a => a && a.type === "region");
  const getProvinces = () => {
    if (regionFilter === "all") return [];
    const region = (areas || []).find(a => a && a.name === regionFilter && a.type === "region");
    if (!region) return [];
    return (areas || []).filter(a => a && a.type === "province" && (a.parent_id === region.id || a.parent_code === region.code));
  };
  
  const getMunicipalities = () => {
    if (provinceFilter === "all") return [];
    const region = (areas || []).find(a => a && a.name === regionFilter && a.type === "region");
    const province = (areas || []).find(a => a && a.name === provinceFilter && a.type === "province" &&
      (region ? (a.parent_id === region.id || a.parent_code === region.code) : true)
    );
    if (!province) return [];
    return (areas || []).filter(a => a && a.type === "municipality" && (a.parent_id === province.id || a.parent_code === province.code));
  };

  const getBarangays = () => {
    if (municipalityFilter === "all") return [];
    const region = (areas || []).find(a => a && a.name === regionFilter && a.type === "region");
    const province = (areas || []).find(a => a && a.name === provinceFilter && a.type === "province" &&
      (region ? (a.parent_id === region.id || a.parent_code === region.code) : true)
    );
    const municipality = (areas || []).find(a => a && a.name === municipalityFilter && a.type === "municipality" && 
      (province ? (a.parent_id === province.id || a.parent_code === province.code) : true)
    );
    if (!municipality) return [];
    return (areas || []).filter(a => a && a.type === "barangay" && (a.parent_id === municipality.id || a.parent_code === municipality.code));
  };

  // Sorting is now handled on the server side
  const currentItems = beneficiaries;

  const currentYear = new Date().getFullYear();
  const years = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2, currentYear - 3];
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="text-center sm:text-left">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100">Redemption Tracking</h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Monthly redemption attendance records</p>
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
                  <SelectItem value="present">Redeemed</SelectItem>
                  <SelectItem value="absent">UnRedeemed</SelectItem>
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
                  {getRegions().map(r => (
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
                  {getProvinces().map(p => (
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
                <SelectTrigger className="w-full sm:w-48 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200">
                  <SelectValue placeholder="Municipality" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Municipalities</SelectItem>
                  {getMunicipalities().map(m => (
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
                <SelectTrigger className="w-full sm:w-48 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200">
                  <SelectValue placeholder="Barangay" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Barangays</SelectItem>
                  {getBarangays().map(b => (
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

      <Card className="border-stone-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="pb-3 border-b dark:border-slate-800">
          <CardTitle className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-600 dark:text-emerald-500" />
            Redemption Records ({totalBeneficiaries})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 relative min-h-[200px]">
          {isLoading && (
            <div className="absolute inset-0 bg-white/50 dark:bg-slate-950/50 z-20 flex items-center justify-center backdrop-blur-[1px]">
              <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {currentItems.length === 0 && !isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500 dark:text-slate-400">
              <FileText className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-lg font-medium">No records found</p>
              <p className="text-sm">Try adjusting your filters or search terms</p>
            </div>
          ) : (currentItems.length > 0 || isLoading) && (
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
                    <TableHead className="font-semibold text-slate-600 dark:text-slate-300 text-center hidden lg:table-cell">Location</TableHead>
                    <TableHead 
                      className="font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-center"
                      onClick={() => handleSort("attendance")}
                    >
                      <div className="flex items-center justify-center">
                        Status {getSortIcon("attendance")}
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-slate-600 dark:text-slate-300 text-center hidden md:table-cell">Reason</TableHead>
                    <TableHead className="font-semibold text-slate-600 dark:text-slate-300 text-center">Remarks</TableHead>
                    <TableHead className="font-semibold text-slate-600 dark:text-slate-300 text-center hidden xl:table-cell">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentItems.map((b) => {
                    const redemption = redemptions.find(r => 
                      r && (
                        (r.beneficiary_id && r.beneficiary_id === b.id) || 
                        (r.hhid && b.hhid && b.hhid !== "0" && b.hhid !== "" && r.hhid === b.hhid)
                      )
                    );
                    return (
                      <TableRow key={b.id} className="border-b dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <TableCell className="font-medium text-slate-700 dark:text-slate-300 text-left pl-6 hidden sm:table-cell">{b.hhid}</TableCell>
                        <TableCell className="text-left sm:text-center">
                          <div className="flex flex-col sm:items-center">
                            <span className="font-medium text-slate-900 dark:text-slate-100">{b.last_name}, {b.first_name}</span>
                            <span className="text-[10px] text-slate-500 sm:hidden">{b.hhid}</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-500 uppercase tracking-wider hidden sm:inline">{b.middle_name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center hidden lg:table-cell">
                          <div className="flex flex-col text-xs text-slate-600 dark:text-slate-400 items-center">
                            <span>{b.barangay}</span>
                            <span>{b.municipality}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-center">
                            <Select
                              value={redemption?.attendance || "none"}
                              onValueChange={(val) => handleUpdate(b, "attendance", val)}
                            >
                              <SelectTrigger className={`w-28 sm:w-32 h-8 text-[10px] sm:text-xs ${
                                redemption?.attendance === "present" 
                                  ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800" 
                                  : redemption?.attendance === "absent"
                                  ? "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800"
                                  : "dark:bg-slate-900 dark:border-slate-700"
                              }`}>
                                <SelectValue placeholder="Status" />
                              </SelectTrigger>
                              <SelectContent className="dark:bg-slate-900 dark:border-slate-800">
                                <SelectItem value="none">Not Recorded</SelectItem>
                                <SelectItem value="present">Redeemed</SelectItem>
                                <SelectItem value="absent">UnRedeemed</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </TableCell>
                        <TableCell className="text-center hidden md:table-cell">
                          <Input
                            placeholder="Reason..."
                            value={redemption?.reason || ""}
                            onChange={(e) => {
                              const newVal = e.target.value;
                              setRedemptions(prev => {
                                const exists = prev.some(r => 
                                  (r.beneficiary_id && r.beneficiary_id === b.id) || 
                                  (r.hhid && b.hhid && b.hhid !== "0" && b.hhid !== "" && r.hhid === b.hhid)
                                );
                                if (exists) {
                                  return prev.map(r => 
                                    ((r.beneficiary_id && r.beneficiary_id === b.id) || 
                                     (r.hhid && b.hhid && b.hhid !== "0" && b.hhid !== "" && r.hhid === b.hhid)) ? { ...r, reason: newVal } : r
                                  );
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
                            disabled={redemption?.attendance !== "absent"}
                            className="h-8 text-xs dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200 text-center"
                           />
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  disabled={!redemption?.attendance || redemption?.attendance === "none"}
                                  className={`h-8 px-2 sm:px-3 text-[10px] sm:text-xs flex items-center gap-1.5 transition-all duration-200 ${
                                    redemption?.action 
                                      ? "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 hover:text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800" 
                                      : "hover:bg-slate-100 dark:hover:bg-slate-800"
                                  }`}
                                >
                                  <Edit className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                  <span className="hidden xs:inline">{redemption?.action || "Select Remarks"}</span>
                                  {!redemption?.action && <span className="xs:hidden">Remarks</span>}
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-[425px] max-w-[95vw] dark:bg-slate-900 dark:border-slate-800">
                                <DialogHeader>
                                  <DialogTitle className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                                    Redemption Remarks
                                  </DialogTitle>
                                  <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                    Select the appropriate remarks for <span className="font-semibold text-slate-700 dark:text-slate-200">{b.last_name}, {b.first_name}</span>
                                  </div>
                                </DialogHeader>
                                <div className="grid gap-4 py-6">
                                  <div className="grid grid-cols-1 gap-3">
                                    {(redemption?.attendance === "present" ? [
                                      { label: "Paid", color: "emerald", description: "Beneficiary has received payment" },
                                      { label: "Zero Balance", color: "amber", description: "No balance remaining for this period" },
                                      { label: "Beneficiary Not Found", color: "rose", description: "Record could not be located in database" }
                                    ] : [
                                      { label: "Unlocated", color: "orange", description: "Beneficiary could not be found in the area" },
                                      { label: "Active 4Ps", color: "blue", description: "Currently active in the 4Ps program" },
                                      { label: "Ineligible", color: "red", description: "Does not meet the criteria for redemption" }
                                    ]).map((opt) => (
                                      <Button
                                        key={opt.label}
                                        variant="outline"
                                        className={`flex flex-col items-start gap-1 h-auto p-4 text-left transition-all duration-200 hover:border-${opt.color}-500 hover:bg-${opt.color}-50/50 dark:hover:bg-${opt.color}-900/10 ${
                                          redemption?.action === opt.label 
                                            ? `border-${opt.color}-500 bg-${opt.color}-50/50 dark:bg-${opt.color}-900/20 ring-1 ring-${opt.color}-500` 
                                            : "border-slate-200 dark:border-slate-800"
                                        }`}
                                        onClick={() => handleUpdate(b, "action", opt.label)}
                                      >
                                        <div className="flex items-center gap-2">
                                          <div className={`w-2 h-2 rounded-full bg-${opt.color}-500`} />
                                          <span className="font-semibold text-slate-900 dark:text-slate-100">{opt.label}</span>
                                        </div>
                                        <span className="text-xs text-slate-500 dark:text-slate-400 pl-4">{opt.description}</span>
                                      </Button>
                                    ))}
                                  </div>
                                  {redemption?.action && (
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      onClick={() => handleUpdate(b, "action", "")}
                                      className="text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20"
                                    >
                                      Clear Selection
                                    </Button>
                                  )}
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </TableCell>
                        <TableCell className="text-center hidden xl:table-cell">
                          <div className="flex items-center justify-center gap-1 text-xs">
                            {redemption && redemption.attendance !== "none" && redemption.action ? (
                              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-500">
                                <CheckCircle className="w-3 h-3" />
                                Saved
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-slate-400 dark:text-slate-500">
                                <XCircle className="w-3 h-3" />
                                Pending
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

export default RedemptionPage;
