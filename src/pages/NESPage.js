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
  const [regionFilter, setRegionFilter] = useState("all");
  const [provinceFilter, setProvinceFilter] = useState("all");
  const [municipalityFilter, setMunicipalityFilter] = useState("all");
  const [barangayFilter, setBarangayFilter] = useState("all");
  
  const now = new Date();
  const [monthFilter, setMonthFilter] = useState(MONTHS[now.getMonth()]);
  const [yearFilter, setYearFilter] = useState(String(now.getFullYear()));
  
  const [attendanceFilter, setAttendanceFilter] = useState("all");
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
      // Handle both paginated and non-paginated responses
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
        const nesResponse = await api.get(`/nes?frm_period=${encodeURIComponent(`${monthFilter} ${yearFilter}`)}&beneficiary_ids=${benIds.join(",")}`);
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
            frm_period: `${monthFilter} ${yearFilter}`,
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
        frm_period: `${monthFilter} ${yearFilter}`,
        attendance: field === "attendance" ? value : (currentNes?.attendance || "none"),
        reason: field === "reason" ? value : (currentNes?.reason || ""),
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

      // Fetch all NES records for the current FRM period
      const nesResponse = await api.get(`/nes?limit=all&frm_period=${encodeURIComponent(`${monthFilter} ${yearFilter}`)}`);
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
          "FRM Period": `${monthFilter} ${yearFilter}`,
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
        { wch: 15 }, // FRM Period
        { wch: 15 }, // Attendance
        { wch: 30 }, // Reason
        { wch: 15 }, // Date Recorded
      ];
      worksheet["!cols"] = wscols;

      XLSX.writeFile(workbook, `nes_records_${monthFilter}_${yearFilter}_${new Date().toISOString().split('T')[0]}.xlsx`);
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

  // Client-side sorting for the current page
  const sortedBeneficiaries = [...beneficiaries].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const direction = sortConfig.direction === "asc" ? 1 : -1;
    
    let aValue = a[sortConfig.key];
    let bValue = b[sortConfig.key];
    
    // Handle null/undefined
    if (aValue === null || aValue === undefined) aValue = "";
    if (bValue === null || bValue === undefined) bValue = "";
    
    // String comparison
    if (typeof aValue === "string" && typeof bValue === "string") {
      aValue = aValue.toLowerCase();
      bValue = bValue.toLowerCase();
    }
    
    if (aValue < bValue) return -1 * direction;
    if (aValue > bValue) return 1 * direction;
    return 0;
  });

  const filteredBeneficiaries = sortedBeneficiaries;
  const currentItems = sortedBeneficiaries;

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  const currentYear = new Date().getFullYear();
  const years = [currentYear + 1, currentYear, currentYear, currentYear - 1, currentYear - 2, currentYear - 3];

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
                  <SelectItem value="present">Attended</SelectItem>
                  <SelectItem value="absent">Missed</SelectItem>
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
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="spinner" />
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
                        Beneficiary Name {getSortIcon("last_name")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                      onClick={() => handleSort("barangay")}
                    >
                      <div className="flex items-center">
                        Barangay {getSortIcon("barangay")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                      onClick={() => handleSort("municipality")}
                    >
                      <div className="flex items-center">
                        Municipality {getSortIcon("municipality")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                      onClick={() => handleSort("province")}
                    >
                      <div className="flex items-center">
                        Province {getSortIcon("province")}
                      </div>
                    </TableHead>
                    <TableHead 
                      className="font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                      onClick={() => handleSort("attendance")}
                    >
                      <div className="flex items-center">
                        Attendance {getSortIcon("attendance")}
                      </div>
                    </TableHead>
                    <TableHead className="font-semibold text-slate-600 dark:text-slate-300">Reason for Absence</TableHead>
                    <TableHead className="font-semibold text-slate-600 dark:text-slate-300">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentItems.map((b) => {
                    const nes = nesRecords.find(r => r.beneficiary_id === b.id);
                    return (
                      <TableRow key={b.id} className="border-b dark:border-slate-800 hover:bg-stone-50 dark:hover:bg-slate-800/30">
                        <TableCell className="font-mono text-sm dark:text-slate-300">{b.hhid}</TableCell>
                        <TableCell className="dark:text-slate-300">{b.last_name}, {b.first_name}</TableCell>
                        <TableCell className="dark:text-slate-300">{b.barangay}</TableCell>
                        <TableCell className="dark:text-slate-300">{b.municipality}</TableCell>
                        <TableCell className="dark:text-slate-300">{b.province}</TableCell>
                        <TableCell>
                          <Select
                            value={nes?.attendance || "none"}
                            onValueChange={(val) => handleUpdate(b, "attendance", val)}
                          >
                            <SelectTrigger className={`w-32 h-8 text-xs ${
                              nes?.attendance === "present" 
                                ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800" 
                                : nes?.attendance === "absent"
                                ? "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800"
                                : "dark:bg-slate-900 dark:border-slate-700"
                            }`}>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent className="dark:bg-slate-900 dark:border-slate-800">
                              <SelectItem value="none">Not Recorded</SelectItem>
                              <SelectItem value="present">Attended</SelectItem>
                              <SelectItem value="absent">Missed</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
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
                                        frm_period: `${monthFilter} ${yearFilter}`,
                                        attendance: "none",
                                        reason: newVal,
                                        date_recorded: new Date().toISOString().split("T")[0]
                                      }];
                                    }
                                  });
                                }}
                                onBlur={(e) => handleUpdate(b, "reason", e.target.value)}
                                 disabled={nes?.attendance !== "missed"}
                                 className="h-8 text-xs dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200"
                               />
                            </TableCell>
                        <TableCell>
                          {nes ? (
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
    </div>
  );
};

export default NESPage;
