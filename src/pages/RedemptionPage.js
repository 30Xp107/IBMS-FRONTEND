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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Search, Edit, Trash2, Calendar, CheckCircle, XCircle, Download, Upload, ArrowUpDown, ArrowUp, ArrowDown, RotateCcw, FileText } from "lucide-react";
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
  
  const now = new Date();
  const [monthFilter, setMonthFilter] = useState(MONTHS[now.getMonth()]);
  const [yearFilter, setYearFilter] = useState(String(now.getFullYear()));
  
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
  const [itemsPerPage] = useState(10);

  useEffect(() => {
    fetchData();
  }, [currentPage, search, monthFilter, yearFilter, attendanceFilter, regionFilter, provinceFilter, municipalityFilter, barangayFilter]);

  useEffect(() => {
    fetchAreas("region");
  }, []);

  const fetchAreas = async (type = null, parentId = null, parentCode = null) => {
    try {
      // Don't fetch if all are null to avoid loading all 40,000+ areas
      if (!type && !parentId && !parentCode) return;

      let query = `?limit=500`; // Use a large enough limit for any single level
      if (type) query += `&type=${type}`;
      if (parentId) query += `&parent_id=${parentId}`;
      if (parentCode) query += `&parent_code=${parentCode}`;

      const response = await api.get(`/areas${query}`);
      const data = Array.isArray(response.data) ? response.data : (response.data.areas || []);
      
      const normalizedData = data.map((area) => ({
        ...area,
        id: String(area._id || area.id),
        type: area.type?.toLowerCase(),
        parent_id: area.parent_id ? (typeof area.parent_id === "object" ? String(area.parent_id?._id || area.parent_id?.id) : String(area.parent_id)) : ""
      }));
      
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

  const fetchData = async () => {
    setIsLoading(true);
    try {
      let benQuery = `?page=${currentPage}&limit=${itemsPerPage}`;
      if (search) benQuery += `&search=${encodeURIComponent(search)}`;
      if (regionFilter !== "all") benQuery += `&region=${encodeURIComponent(regionFilter)}`;
      if (provinceFilter !== "all") benQuery += `&province=${encodeURIComponent(provinceFilter)}`;
      if (municipalityFilter !== "all") benQuery += `&municipality=${encodeURIComponent(municipalityFilter)}`;
      if (barangayFilter !== "all") benQuery += `&barangay=${encodeURIComponent(barangayFilter)}`;

      const response = await api.get(`/beneficiaries${benQuery}`);
      const data = response.data;
      const benList = data.beneficiaries || [];
      const benIds = benList.map(b => String(b._id || b.id));

      setBeneficiaries(benList.map(b => ({
        ...b,
        id: String(b._id || b.id)
      })));
      
      setTotalBeneficiaries(data.total || 0);
      setTotalPages(data.totalPages || 1);
      
      // Now fetch redemption records only for these beneficiaries
      if (benIds.length > 0) {
        const redResponse = await api.get(`/redemptions?frm_period=${encodeURIComponent(`${monthFilter} ${yearFilter}`)}&beneficiary_ids=${benIds.join(",")}`);
        const redData = Array.isArray(redResponse.data) ? redResponse.data : (redResponse.data.redemptions || []);
        setRedemptions(redData.map(r => ({
          ...r,
          id: String(r._id || r.id),
          beneficiary_id: r.beneficiary_id ? (typeof r.beneficiary_id === "object" ? String(r.beneficiary_id?._id || r.beneficiary_id?.id) : String(r.beneficiary_id)) : ""
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
    // Optimistic update for local state
    const currentRedemption = redemptions.find(r => r.beneficiary_id === beneficiary.id);
    
    if (field === "attendance" && value === "none") {
      if (currentRedemption && currentRedemption.id) {
        try {
          await api.delete(`/redemptions/${currentRedemption.id}`);
          setRedemptions(prev => prev.filter(r => r.beneficiary_id !== beneficiary.id));
          toast.success("Record cleared");
        } catch (error) {
          toast.error("Failed to clear record");
        }
      }
      return;
    }

    // Optimistically update the status if it's an attendance or action change
    if (field === "attendance" || field === "action") {
      setRedemptions(prev => {
        const exists = prev.some(r => r.beneficiary_id === beneficiary.id);
        if (exists) {
          return prev.map(r => r.beneficiary_id === beneficiary.id ? { ...r, [field]: value } : r);
        } else {
          return [...prev, {
            beneficiary_id: beneficiary.id,
            hhid: beneficiary.hhid,
            frm_period: `${monthFilter} ${yearFilter}`,
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
        frm_period: `${monthFilter} ${yearFilter}`,
        attendance: field === "attendance" ? value : (currentRedemption?.attendance || "none"),
        reason: field === "reason" ? value : (currentRedemption?.reason || ""),
        action: field === "action" ? value : (currentRedemption?.action || ""),
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
      
      // Fetch all beneficiaries for the current filter
      let benQuery = `?limit=all`;
      if (search) benQuery += `&search=${encodeURIComponent(search)}`;
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

      // Fetch all redemptions for the current FRM period
      const redResponse = await api.get(`/redemptions?limit=all&frm_period=${encodeURIComponent(`${monthFilter} ${yearFilter}`)}`);
      const allRedemptions = (redResponse.data.redemptions || []).map(r => ({
        ...r,
        beneficiary_id: r.beneficiary_id ? (typeof r.beneficiary_id === "object" ? String(r.beneficiary_id?._id || r.beneficiary_id?.id) : String(r.beneficiary_id)) : ""
      }));

      const exportData = allBeneficiaries.map(b => {
        const redemption = allRedemptions.find(r => r.beneficiary_id === b.id);
        return {
          "HHID": b.hhid,
          "Last Name": b.last_name,
          "First Name": b.first_name,
          "Region": b.region,
          "Province": b.province,
          "Municipality": b.municipality,
          "Barangay": b.barangay,
          "FRM Period": `${monthFilter} ${yearFilter}`,
          "Attendance": redemption?.attendance || "none",
          "Reason": redemption?.reason || "",
          "Action": redemption?.action || "",
          "Date Recorded": redemption?.date_recorded || ""
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Redemptions");
      
      const wscols = [
        { wch: 15 }, // HHID
        { wch: 20 }, // Last Name
        { wch: 20 }, // First Name
        { wch: 20 }, // Region
        { wch: 20 }, // Province
        { wch: 20 }, // Municipality
        { wch: 20 }, // Barangay
        { wch: 15 }, // FRM Period
        { wch: 15 }, // Attendance
        { wch: 30 }, // Reason
        { wch: 25 }, // Action
        { wch: 15 }, // Date Recorded
      ];
      worksheet["!cols"] = wscols;

      XLSX.writeFile(workbook, `redemptions_${monthFilter}_${yearFilter}_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.dismiss(toastId);
      toast.success(`Exported ${allBeneficiaries.length} records`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export data");
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(worksheet);

        if (rows.length === 0) {
          toast.error("File is empty");
          return;
        }

        const loadingToast = toast.loading(`Importing ${rows.length} records...`);
        let successCount = 0;

        for (const row of rows) {
          try {
            const hhid = String(row["HHID"] || "").trim();
            const attendance = String(row["Attendance"] || "").toLowerCase().trim();
            const reason = String(row["Reason"] || "").trim();
            const actionTaken = String(row["Action"] || "").trim();

            if (!hhid) continue;

            const beneficiary = beneficiaries.find(b => b.hhid === hhid);
            if (!beneficiary) continue;

            const updateData = {
              beneficiary_id: beneficiary.id,
              hhid: beneficiary.hhid,
              frm_period: `${monthFilter} ${yearFilter}`,
              attendance: ["present", "absent", "none", "redeemed", "unredeemed"].includes(attendance) ? attendance : "none",
              reason: reason,
              action: actionTaken,
              date_recorded: new Date().toISOString().split("T")[0],
            };

            await api.post("/redemptions/upsert", updateData);
            successCount++;
          } catch (err) {
            console.error("Import error for row:", row, err);
          }
        }

        toast.dismiss(loadingToast);
        toast.success(`Successfully imported ${successCount} records`);
        fetchData();
      } catch (error) {
        toast.error("Failed to parse file");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = null;
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [search, attendanceFilter, sortConfig, regionFilter, provinceFilter, municipalityFilter, barangayFilter]);

  const getRegions = () => areas.filter(a => a.type === "region");
  const getProvinces = () => {
    if (regionFilter === "all") return [];
    const region = areas.find(a => a.name === regionFilter && a.type === "region");
    if (!region) return [];
    return areas.filter(a => a.type === "province" && (a.parent_id === region.id || a.parent_code === region.code));
  };
  
  const getMunicipalities = () => {
    if (provinceFilter === "all") return [];
    const region = areas.find(a => a.name === regionFilter && a.type === "region");
    const province = areas.find(a => a.name === provinceFilter && a.type === "province" &&
      (region ? (a.parent_id === region.id || a.parent_code === region.code) : true)
    );
    if (!province) return [];
    return areas.filter(a => a.type === "municipality" && (a.parent_id === province.id || a.parent_code === province.code));
  };

  const getBarangays = () => {
    if (municipalityFilter === "all") return [];
    const region = areas.find(a => a.name === regionFilter && a.type === "region");
    const province = areas.find(a => a.name === provinceFilter && a.type === "province" &&
      (region ? (a.parent_id === region.id || a.parent_code === region.code) : true)
    );
    const municipality = areas.find(a => a.name === municipalityFilter && a.type === "municipality" && 
      (province ? (a.parent_id === province.id || a.parent_code === province.code) : true)
    );
    if (!municipality) return [];
    return areas.filter(a => a.type === "barangay" && (a.parent_id === municipality.id || a.parent_code === municipality.code));
  };

  // Client-side sorting for the current page
  const sortedBeneficiaries = [...beneficiaries].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const direction = sortConfig.direction === "asc" ? 1 : -1;
    
    let aValue, bValue;
    
    if (sortConfig.key === "attendance") {
      const redA = redemptions.find(r => r.beneficiary_id === a.id);
      const redB = redemptions.find(r => r.beneficiary_id === b.id);
      aValue = redA?.attendance || "none";
      bValue = redB?.attendance || "none";
    } else {
      aValue = a[sortConfig.key];
      bValue = b[sortConfig.key];
      
      // Handle null/undefined
      if (aValue === null || aValue === undefined) aValue = "";
      if (bValue === null || bValue === undefined) bValue = "";
      
      // String comparison
      if (typeof aValue === "string" && typeof bValue === "string") {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }
    }
    
    if (aValue < bValue) return -1 * direction;
    if (aValue > bValue) return 1 * direction;
    return 0;
  });

  const filteredBeneficiaries = sortedBeneficiaries.filter(b => {
    if (attendanceFilter === "all") return true;
    
    const redemption = redemptions.find(r => r.beneficiary_id === b.id);
    const status = redemption?.attendance || "none";
    
    return status === attendanceFilter;
  });

  const currentItems = filteredBeneficiaries;

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

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
                <Label className="whitespace-nowrap dark:text-slate-300">Month:</Label>
                <Select value={monthFilter} onValueChange={(v) => {
                  setMonthFilter(v);
                  setCurrentPage(1);
                }}>
                  <SelectTrigger className="w-full sm:w-32 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200">
                    <SelectValue placeholder="Month" />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-slate-900 dark:border-slate-800 max-h-[300px]">
                    {MONTHS.map((month) => (
                      <SelectItem key={month} value={month}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Label className="whitespace-nowrap dark:text-slate-300 ml-2">Year:</Label>
                <Select value={yearFilter} onValueChange={(v) => {
                  setYearFilter(v);
                  setCurrentPage(1);
                }}>
                  <SelectTrigger className="w-full sm:w-28 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200">
                    <SelectValue placeholder="Year" />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-slate-900 dark:border-slate-800">
                    {years.map((year) => (
                      <SelectItem key={year} value={String(year)}>
                        {year}
                      </SelectItem>
                    ))}
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
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
            </div>
          ) : beneficiaries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-500 dark:text-slate-400">
              <FileText className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-lg font-medium">No records found</p>
              <p className="text-sm">Try adjusting your filters or search terms</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-stone-100 dark:bg-slate-800/50 hover:bg-stone-100 dark:hover:bg-slate-800/50 border-b dark:border-slate-800">
                    <TableHead 
                      className="font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                      onClick={() => handleSort("hhid")}
                    >
                      <div className="flex items-center">
                        HHID {getSortIcon("hhid")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                      onClick={() => handleSort("last_name")}
                    >
                      <div className="flex items-center">
                        Name {getSortIcon("last_name")}
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-slate-600 dark:text-slate-300">Location</TableHead>
                    <TableHead 
                      className="font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                      onClick={() => handleSort("attendance")}
                    >
                      <div className="flex items-center">
                        Status {getSortIcon("attendance")}
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-slate-600 dark:text-slate-300">Reason</TableHead>
                    <TableHead className="font-semibold text-slate-600 dark:text-slate-300 text-center">Action</TableHead>
                    <TableHead className="font-semibold text-slate-600 dark:text-slate-300">Record Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentItems.map((b) => {
                    const redemption = redemptions.find(r => r.beneficiary_id === b.id);
                    return (
                      <TableRow key={b.id} className="border-b dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <TableCell className="font-medium text-slate-700 dark:text-slate-300">{b.hhid}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-900 dark:text-slate-100">{b.last_name}, {b.first_name}</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-500 uppercase tracking-wider">{b.middle_name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col text-xs text-slate-600 dark:text-slate-400">
                            <span>{b.barangay}</span>
                            <span>{b.municipality}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={redemption?.attendance || "none"}
                            onValueChange={(val) => handleUpdate(b, "attendance", val)}
                          >
                            <SelectTrigger className={`w-32 h-8 text-xs ${
                              redemption?.attendance === "present" 
                                ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800" 
                                : redemption?.attendance === "absent"
                                ? "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800"
                                : "dark:bg-slate-900 dark:border-slate-700"
                            }`}>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent className="dark:bg-slate-900 dark:border-slate-800">
                              <SelectItem value="none">Not Recorded</SelectItem>
                              <SelectItem value="present">Redeemed</SelectItem>
                              <SelectItem value="absent">UnRedeemed</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                              <Input
                                placeholder="Reason..."
                                value={redemption?.reason || ""}
                                onChange={(e) => {
                                  const newVal = e.target.value;
                                  setRedemptions(prev => {
                                    const exists = prev.some(r => r.beneficiary_id === b.id);
                                    if (exists) {
                                      return prev.map(r => r.beneficiary_id === b.id ? { ...r, reason: newVal } : r);
                                    } else {
                                      return [...prev, { 
                                        beneficiary_id: b.id, 
                                        hhid: b.hhid,
                                        frm_period: `${monthFilter} ${yearFilter}`,
                                        attendance: "none",
                                        reason: newVal,
                                        date_recorded: new Date().toISOString().split("T")[0]
                                      }];
                                    }
                                  });
                                }}
                                onBlur={(e) => handleUpdate(b, "reason", e.target.value)}
                                disabled={redemption?.attendance !== "absent"}
                                className="h-8 text-xs dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200"
                               />
                            </TableCell>
                            <TableCell className="text-center">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className={`h-8 px-3 text-xs flex items-center gap-1.5 transition-all duration-200 ${
                                      redemption?.action 
                                        ? "bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 hover:text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800" 
                                        : "hover:bg-slate-100 dark:hover:bg-slate-800"
                                    }`}
                                  >
                                    <Edit className="w-3.5 h-3.5" />
                                    {redemption?.action || "Select Action"}
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[425px] dark:bg-slate-900 dark:border-slate-800">
                                  <DialogHeader>
                                    <DialogTitle className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                                      Redemption Action
                                    </DialogTitle>
                                    <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                      Select the appropriate action for <span className="font-semibold text-slate-700 dark:text-slate-200">{b.last_name}, {b.first_name}</span>
                                    </div>
                                  </DialogHeader>
                                  <div className="grid gap-4 py-6">
                                    <div className="grid grid-cols-1 gap-3">
                                      {[
                                        { label: "Paid", color: "emerald", description: "Beneficiary has received payment" },
                                        { label: "Zero Balance", color: "amber", description: "No balance remaining for this period" },
                                        { label: "Beneficiary Not Found", color: "rose", description: "Record could not be located in database" }
                                      ].map((opt) => (
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
                            </TableCell>
                        <TableCell>
                          {redemption ? (
                            <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-500">
                              <CheckCircle className="w-3 h-3" />
                              Saved
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                              <XCircle className="w-3 h-3" />
                              Pending
                            </span>
                          )}
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
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 py-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => paginate(currentPage - 1)}
            disabled={currentPage === 1}
            className="dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Previous
          </Button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(page => {
              // Show first, last, and pages around current
              return page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1;
            })
            .map((page, index, array) => (
              <div key={page} className="flex items-center">
                {index > 0 && array[index - 1] !== page - 1 && (
                  <span className="px-2 text-slate-400 dark:text-slate-600">...</span>
                )}
                <Button
                  variant={currentPage === page ? "default" : "outline"}
                  size="sm"
                  onClick={() => paginate(page)}
                  className={`w-8 ${currentPage === page ? 'dark:bg-emerald-600 dark:text-white' : 'dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800'}`}
                >
                  {page}
                </Button>
              </div>
            ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => paginate(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Next
          </Button>
        </div>
      )}

      {/* Import Controls */}
      <div className="flex items-center justify-end gap-2 pt-2">
        <input
          type="file"
          id="import-excel"
          className="hidden"
          accept=".xlsx, .xls"
          onChange={handleImport}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => document.getElementById("import-excel").click()}
          className="border-emerald-600 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 dark:border-emerald-500 dark:text-emerald-400"
        >
          <Upload className="w-3.5 h-3.5 mr-1.5" />
          Import from Excel
        </Button>
      </div>
    </div>
  );
};

export default RedemptionPage;
