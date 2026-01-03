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
import { Plus, Search, Edit, Trash2, Calendar, CheckCircle, XCircle, Download, Upload, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import * as XLSX from "xlsx";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const getCurrentFrmPeriod = () => {
  const now = new Date();
  return `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
};

const RedemptionPage = () => {
  const { api, isAdmin } = useAuth();
  const [redemptions, setRedemptions] = useState([]);
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [frmFilter, setFrmFilter] = useState(getCurrentFrmPeriod());
  const [attendanceFilter, setAttendanceFilter] = useState("all");
  const [sortConfig, setSortConfig] = useState({ key: "last_name", direction: "asc" });
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  useEffect(() => {
    fetchData();
  }, [frmFilter]);

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
      const [redResponse, benResponse] = await Promise.all([
        api.get(`/redemptions?frm_period=${encodeURIComponent(frmFilter)}`),
        api.get("/beneficiaries")
      ]);
      
      // Normalize IDs
      const normalizedRed = redResponse.data.map(r => ({
        ...r,
        id: String(r._id || r.id),
        beneficiary_id: r.beneficiary_id ? (typeof r.beneficiary_id === "object" ? String(r.beneficiary_id?._id || r.beneficiary_id?.id) : String(r.beneficiary_id)) : ""
      }));
      
      const normalizedBen = benResponse.data.map(b => ({
        ...b,
        id: String(b._id || b.id)
      }));

      setRedemptions(normalizedRed);
      setBeneficiaries(normalizedBen);
    } catch (error) {
      toast.error("Failed to load data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async (beneficiary, field, value) => {
    try {
      const currentRedemption = redemptions.find(r => r.beneficiary_id === beneficiary.id) || {};
      
      const updateData = {
        beneficiary_id: beneficiary.id,
        hhid: beneficiary.hhid,
        frm_period: frmFilter,
        attendance: field === "attendance" ? value : (currentRedemption.attendance || ""),
        reason: field === "reason" ? value : (currentRedemption.reason || ""),
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
      
      // Update local state
      setRedemptions(prev => {
        const index = prev.findIndex(r => r.beneficiary_id === beneficiary.id);
        if (index > -1) {
          const newRed = [...prev];
          newRed[index] = updatedRed;
          return newRed;
        }
        return [...prev, updatedRed];
      });

      toast.success("Record updated");
    } catch (error) {
      toast.error("Failed to update record");
    }
  };

  const handleExport = () => {
    if (beneficiaries.length === 0) {
      toast.error("No data to export");
      return;
    }

    const exportData = beneficiaries.map(b => {
      const redemption = redemptions.find(r => r.beneficiary_id === b.id);
      return {
        "HHID": b.hhid,
        "Last Name": b.last_name,
        "First Name": b.first_name,
        "Barangay": b.barangay,
        "Municipality": b.municipality,
        "Province": b.province,
        "FRM Period": frmFilter,
        "Attendance": redemption?.attendance || "none",
        "Reason": redemption?.reason || "",
        "Date Recorded": redemption?.date_recorded || ""
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Redemptions");
    
    // Set column widths
    const wscols = [
      { wch: 15 }, // HHID
      { wch: 20 }, // Last Name
      { wch: 20 }, // First Name
      { wch: 20 }, // Barangay
      { wch: 20 }, // Municipality
      { wch: 20 }, // Province
      { wch: 15 }, // FRM Period
      { wch: 15 }, // Attendance
      { wch: 30 }, // Reason
      { wch: 15 }, // Date Recorded
    ];
    worksheet["!cols"] = wscols;

    XLSX.writeFile(workbook, `redemptions_${frmFilter.replace(" ", "_")}_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success("Redemptions exported successfully");
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

            if (!hhid) continue;

            const beneficiary = beneficiaries.find(b => b.hhid === hhid);
            if (!beneficiary) continue;

            const updateData = {
              beneficiary_id: beneficiary.id,
              hhid: beneficiary.hhid,
              frm_period: frmFilter,
              attendance: ["present", "absent", "none"].includes(attendance) ? attendance : "none",
              reason: reason,
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
  }, [search, attendanceFilter, sortConfig]);

  const filteredBeneficiaries = beneficiaries.filter((b) => {
    const redemption = redemptions.find(r => r.beneficiary_id === b.id);
    const attendance = redemption?.attendance || "none";
    
    const matchesSearch = b.hhid.toLowerCase().includes(search.toLowerCase()) || 
                         `${b.first_name} ${b.last_name}`.toLowerCase().includes(search.toLowerCase());
    const matchesAttendance = attendanceFilter === "all" || attendance === attendanceFilter;
    
    return matchesSearch && matchesAttendance;
  }).sort((a, b) => {
    const key = sortConfig.key;
    const direction = sortConfig.direction === "asc" ? 1 : -1;
    
    let aValue, bValue;
    
    if (key === "attendance") {
      const redA = redemptions.find(r => r.beneficiary_id === a.id);
      const redB = redemptions.find(r => r.beneficiary_id === b.id);
      aValue = redA?.attendance || "none";
      bValue = redB?.attendance || "none";
    } else {
      aValue = String(a[key] || "").toLowerCase();
      bValue = String(b[key] || "").toLowerCase();
    }

    if (aValue < bValue) return -1 * direction;
    if (aValue > bValue) return 1 * direction;
    return 0;
  });

  // Pagination logic
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredBeneficiaries.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredBeneficiaries.length / itemsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

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
          <div className="flex flex-col md:flex-row gap-4">
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
              <Select value={attendanceFilter} onValueChange={(v) => {
                setAttendanceFilter(v);
                setCurrentPage(1);
              }}>
                <SelectTrigger className="w-full sm:w-40 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200">
                  <SelectValue placeholder="Filter Attendance" />
                </SelectTrigger>
                <SelectContent className="dark:bg-slate-900 dark:border-slate-800">
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="present">Redeemed</SelectItem>
                  <SelectItem value="absent">Unredeemed</SelectItem>
                  <SelectItem value="none">No Record</SelectItem>
                </SelectContent>
              </Select>

              <Label className="whitespace-nowrap dark:text-slate-300 ml-2">FRM Period:</Label>
              <Select value={frmFilter} onValueChange={(v) => {
                setFrmFilter(v);
                setCurrentPage(1);
              }}>
                <SelectTrigger className="w-full sm:w-48 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200">
                  <SelectValue placeholder="Select Period" />
                </SelectTrigger>
                <SelectContent className="dark:bg-slate-900 dark:border-slate-800">
                  {MONTHS.map((month) => {
                    const year = new Date().getFullYear();
                    return (
                      <SelectItem key={month} value={`${month} ${year}`}>
                        {month} {year}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="border-stone-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="pb-3 border-b dark:border-slate-800">
          <CardTitle className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-600 dark:text-emerald-500" />
            Attendance List ({filteredBeneficiaries.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="spinner" />
            </div>
          ) : filteredBeneficiaries.length === 0 ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
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
                    const redemption = redemptions.find(r => r.beneficiary_id === b.id);
                    return (
                      <TableRow key={b.id} className="border-b dark:border-slate-800 hover:bg-stone-50 dark:hover:bg-slate-800/30">
                        <TableCell className="font-mono text-sm dark:text-slate-300">{b.hhid}</TableCell>
                        <TableCell className="dark:text-slate-300">{b.last_name}, {b.first_name}</TableCell>
                        <TableCell className="dark:text-slate-300">{b.barangay}</TableCell>
                        <TableCell className="dark:text-slate-300">{b.municipality}</TableCell>
                        <TableCell className="dark:text-slate-300">{b.province}</TableCell>
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
                              <SelectItem value="absent">Unredeemed</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {redemption?.attendance === "absent" ? (
                            <Input
                              placeholder="Reason..."
                              value={redemption.reason || ""}
                              onBlur={(e) => handleUpdate(b, "reason", e.target.value)}
                              className="h-8 text-xs dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200"
                            />
                          ) : "-"}
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
    </div>
  );
};

export default RedemptionPage;
