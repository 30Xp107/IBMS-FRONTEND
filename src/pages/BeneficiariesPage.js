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
import { toast } from "sonner";
import { Plus, Search, Edit, Trash2, Users, Download, Upload, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import * as XLSX from "xlsx";

const BeneficiariesPage = () => {
  const { api, isAdmin } = useAuth();
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [areas, setAreas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [provinceFilter, setProvinceFilter] = useState("all");
  const [municipalityFilter, setMunicipalityFilter] = useState("all");
  const [barangayFilter, setBarangayFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: "last_name", direction: "asc" });
  const itemsPerPage = 10;

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
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBeneficiary, setEditingBeneficiary] = useState(null);
  const [formData, setFormData] = useState({
    hhid: "",
    pkno: "",
    first_name: "",
    last_name: "",
    middle_name: "",
    birthdate: "",
    gender: "",
    barangay: "",
    municipality: "",
    province: "",
    contact: "",
  });

  useEffect(() => {
    fetchBeneficiaries();
    fetchAreas();
  }, []);

  const fetchAreas = async () => {
    try {
      const response = await api.get("/areas");
      const normalizedData = response.data.map((area) => ({
        ...area,
        id: String(area._id || area.id),
        type: area.type?.toLowerCase(),
        parent_id: area.parent_id ? (typeof area.parent_id === "object" ? String(area.parent_id?._id || area.parent_id?.id) : String(area.parent_id)) : ""
      }));
      setAreas(normalizedData);
    } catch (error) {
      console.error("Failed to load areas");
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [search, provinceFilter, municipalityFilter, barangayFilter, sortConfig]);

  const normalizeGender = (gender) => {
    if (!gender) return "";
    const g = gender.toLowerCase().trim();
    if (g === "m" || g === "male") return "male";
    if (g === "f" || g === "female") return "female";
    return "";
  };

  const fetchBeneficiaries = async () => {
    try {
      const response = await api.get("/beneficiaries");
      const normalizedData = response.data.map(b => ({
        ...b,
        id: String(b._id || b.id)
      }));
      setBeneficiaries(normalizedData);
    } catch (error) {
      toast.error("Failed to load beneficiaries");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name, value) => {
    setFormData((prev) => {
      const newData = { ...prev, [name]: value };
      
      // Reset dependent fields when parent changes
      if (name === "province") {
        newData.municipality = "";
        newData.barangay = "";
      } else if (name === "municipality") {
        newData.barangay = "";
      }
      
      return newData;
    });
  };

  const getProvinces = () => areas.filter(a => a.type === "province");
  
  const getMunicipalities = () => {
    if (!formData.province) return [];
    const province = areas.find(a => a.name === formData.province && a.type === "province");
    if (!province) return [];
    return areas.filter(a => a.type === "municipality" && a.parent_id === province.id);
  };

  const getBarangays = () => {
    if (!formData.municipality) return [];
    const municipality = areas.find(a => a.name === formData.municipality && a.type === "municipality" && 
      (formData.province ? a.parent_id === areas.find(p => p.name === formData.province && p.type === "province")?.id : true)
    );
    if (!municipality) return [];
    return areas.filter(a => a.type === "barangay" && a.parent_id === municipality.id);
  };

  const resetForm = () => {
    setFormData({
      hhid: "",
      pkno: "",
      first_name: "",
      last_name: "",
      middle_name: "",
      birthdate: "",
      gender: "",
      barangay: "",
      municipality: "",
      province: "",
      contact: "",
    });
    setEditingBeneficiary(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingBeneficiary) {
        await api.put(`/beneficiaries/${editingBeneficiary.id}`, formData);
        toast.success("Beneficiary updated successfully");
      } else {
        await api.post("/beneficiaries", formData);
        toast.success("Beneficiary added successfully");
      }
      fetchBeneficiaries();
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      toast.error(error.response?.data?.detail || "Operation failed");
    }
  };

  const handleEdit = (beneficiary) => {
    setEditingBeneficiary(beneficiary);
    setFormData({
      hhid: beneficiary.hhid,
      pkno: beneficiary.pkno,
      first_name: beneficiary.first_name,
      last_name: beneficiary.last_name,
      middle_name: beneficiary.middle_name || "",
      birthdate: beneficiary.birthdate,
      gender: normalizeGender(beneficiary.gender),
      barangay: beneficiary.barangay,
      municipality: beneficiary.municipality,
      province: beneficiary.province,
      contact: beneficiary.contact || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this beneficiary?")) return;
    try {
      await api.delete(`/beneficiaries/${id}`);
      toast.success("Beneficiary deleted");
      fetchBeneficiaries();
    } catch (error) {
      toast.error("Failed to delete beneficiary");
    }
  };

  const handleExport = () => {
    if (beneficiaries.length === 0) {
      toast.error("No data to export");
      return;
    }

    const headers = [
      "HHID",
      "PKNO",
      "First Name",
      "Last Name",
      "Middle Name",
      "Birthdate",
      "Gender",
      "Barangay",
      "Municipality",
      "Province",
      "Contact"
    ];

    const csvContent = [
      headers.join(","),
      ...beneficiaries.map(b => [
        `"${b.hhid}"`,
        `"${b.pkno}"`,
        `"${b.first_name}"`,
        `"${b.last_name}"`,
        `"${b.middle_name || ""}"`,
        `"${b.birthdate}"`,
        `"${b.gender}"`,
        `"${b.barangay}"`,
        `"${b.municipality}"`,
        `"${b.province}"`,
        `"${b.contact || ""}"`
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `beneficiaries_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Beneficiaries exported successfully");
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = new Uint8Array(event.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Use header: 1 to get an array of arrays, which is more reliable
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (rows.length < 2) {
          toast.error("The file is empty or missing data");
          return;
        }

        // Find the header row (usually the first row, but we'll look for HHID just in case)
        const headerRowIndex = rows.findIndex(row => 
          row.some(cell => String(cell).toLowerCase().replace(/[^a-z0-9]/g, '').includes('hhid'))
        );

        if (headerRowIndex === -1) {
          toast.error("Could not find the header row. Please ensure your file has an 'HHID' column.");
          return;
        }

        const headers = rows[headerRowIndex].map(h => String(h).toLowerCase().replace(/[^a-z0-9]/g, ''));
        const dataRows = rows.slice(headerRowIndex + 1);

        const mappedData = dataRows
          .map(row => {
            const getColVal = (keys) => {
              const colIndex = headers.findIndex(h => 
                keys.some(key => h === key.toLowerCase().replace(/[^a-z0-9]/g, ''))
              );
              if (colIndex === -1) return "";
              const val = row[colIndex];
              return (val === undefined || val === null) ? "" : String(val).trim();
            };

            const hhid = getColVal(["HHID", "HouseholdID"]);
            const pkno = getColVal(["PKNO", "PKN", "PantawidID"]);
            const first_name = getColVal(["First Name", "FirstName", "First_Name"]);
            const last_name = getColVal(["Last Name", "LastName", "Last_Name"]);

            // Skip empty rows
            if (!hhid && !pkno && !first_name && !last_name) return null;

            return {
              hhid,
              pkno,
              first_name,
              last_name,
              middle_name: getColVal(["Middle Name", "MiddleName", "Middle_Name"]),
              birthdate: getColVal(["Birthdate", "Birth Date"]),
              gender: normalizeGender(getColVal(["Gender", "Sex"])),
              barangay: getColVal(["Barangay"]),
              municipality: getColVal(["Municipality"]),
              province: getColVal(["Province"]),
              contact: getColVal(["Contact", "Phone"])
            };
          })
          .filter(b => b !== null);

        // Basic validation
        const invalidRows = mappedData.filter(b => !b.hhid || b.pkno === "" || !b.first_name || !b.last_name);
        
        if (invalidRows.length > 0) {
          // Find out which specific field is missing to help the user
          const sample = invalidRows[0];
          let missing = [];
          if (!sample.hhid) missing.push("HHID");
          if (sample.pkno === "") missing.push("PKNO");
          if (!sample.first_name) missing.push("First Name");
          if (!sample.last_name) missing.push("Last Name");
          
          toast.error(`Invalid data in ${invalidRows.length} rows. Missing: ${missing.join(", ")}`);
          return;
        }

        const loadingToast = toast.loading(`Importing ${mappedData.length} beneficiaries...`);
        
        try {
          // Send all records to backend
          // We'll use a loop for now if there's no bulk endpoint, but ideally there should be one
          let successCount = 0;
          for (const beneficiary of mappedData) {
            try {
              await api.post("/beneficiaries", beneficiary);
              successCount++;
            } catch (err) {
              console.error(`Failed to import beneficiary ${beneficiary.hhid}:`, err);
            }
          }

          toast.dismiss(loadingToast);
          toast.success(`Successfully imported ${successCount} of ${mappedData.length} beneficiaries`);
          fetchBeneficiaries();
        } catch (error) {
          toast.dismiss(loadingToast);
          toast.error("Failed to import beneficiaries");
        }
      } catch (error) {
        console.error("Error parsing file:", error);
        toast.error("Error parsing file. Please ensure it's a valid Excel or CSV file.");
      }
    };
    reader.readAsArrayBuffer(file);
    // Reset input
    e.target.value = null;
  };

  const filteredBeneficiaries = beneficiaries.filter(
    (b) => {
      const matchesSearch = b.hhid.toLowerCase().includes(search.toLowerCase()) ||
        b.first_name.toLowerCase().includes(search.toLowerCase()) ||
        b.last_name.toLowerCase().includes(search.toLowerCase()) ||
        b.pkno.toLowerCase().includes(search.toLowerCase());
      
      const matchesProvince = provinceFilter === "all" || b.province === provinceFilter;
      const matchesMunicipality = municipalityFilter === "all" || b.municipality === municipalityFilter;
      const matchesBarangay = barangayFilter === "all" || b.barangay === barangayFilter;

      return matchesSearch && matchesProvince && matchesMunicipality && matchesBarangay;
    }
  ).sort((a, b) => {
    const key = sortConfig.key;
    const direction = sortConfig.direction === "asc" ? 1 : -1;
    
    const aValue = String(a[key] || "").toLowerCase();
    const bValue = String(b[key] || "").toLowerCase();

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
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100">Beneficiaries</h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Manage program beneficiaries</p>
        </div>
        {isAdmin && (
          <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => document.getElementById("excel-import").click()}
              className="border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 dark:border-blue-500 dark:text-blue-400 text-xs sm:text-sm h-9 sm:h-10"
            >
              <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
              Import
            </Button>
            <input
              id="excel-import"
              type="file"
              accept=".xlsx, .xls, .csv"
              onChange={handleImport}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={handleExport}
              className="border-emerald-600 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 dark:border-emerald-500 dark:text-emerald-400 text-xs sm:text-sm h-9 sm:h-10"
            >
              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
              Export
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="col-span-2 sm:col-auto bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white text-xs sm:text-sm h-9 sm:h-10">
                  <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                  Add Beneficiary
                </Button>
              </DialogTrigger>
            <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto dark:bg-slate-900 dark:border-slate-800 p-4 sm:p-6">
              <DialogHeader>
                <DialogTitle className="dark:text-slate-100 text-lg sm:text-xl">
                  {editingBeneficiary ? "Edit Beneficiary" : "Add New Beneficiary"}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 mt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="hhid" className="text-xs sm:text-sm">HHID *</Label>
                    <Input
                      id="hhid"
                      name="hhid"
                      value={formData.hhid}
                      onChange={handleInputChange}
                      required
                      disabled={!!editingBeneficiary}
                      className="h-9 sm:h-10 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="pkno" className="text-xs sm:text-sm">PKNO *</Label>
                    <Input
                      id="pkno"
                      name="pkno"
                      value={formData.pkno}
                      onChange={handleInputChange}
                      required
                      className="h-9 sm:h-10 text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="first_name" className="text-xs sm:text-sm">First Name *</Label>
                    <Input
                      id="first_name"
                      name="first_name"
                      value={formData.first_name}
                      onChange={handleInputChange}
                      required
                      className="h-9 sm:h-10 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="middle_name" className="text-xs sm:text-sm">Middle Name</Label>
                    <Input
                      id="middle_name"
                      name="middle_name"
                      value={formData.middle_name}
                      onChange={handleInputChange}
                      className="h-9 sm:h-10 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="last_name" className="text-xs sm:text-sm">Last Name *</Label>
                    <Input
                      id="last_name"
                      name="last_name"
                      value={formData.last_name}
                      onChange={handleInputChange}
                      required
                      className="h-9 sm:h-10 text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="birthdate" className="text-xs sm:text-sm">Birthdate *</Label>
                    <Input
                      id="birthdate"
                      name="birthdate"
                      type="date"
                      value={formData.birthdate}
                      onChange={handleInputChange}
                      required
                      className="h-9 sm:h-10 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="gender" className="text-xs sm:text-sm">Gender *</Label>
                    <Select
                      value={formData.gender}
                      onValueChange={(value) => handleSelectChange("gender", value)}
                    >
                      <SelectTrigger className="h-9 sm:h-10 text-sm">
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="province" className="text-xs sm:text-sm">Province *</Label>
                    <Select
                      value={formData.province}
                      onValueChange={(value) => handleSelectChange("province", value)}
                    >
                      <SelectTrigger className="h-9 sm:h-10 text-sm">
                        <SelectValue placeholder="Select province" />
                      </SelectTrigger>
                      <SelectContent>
                        {getProvinces().map((province) => (
                          <SelectItem key={province.id} value={province.name}>
                            {province.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="municipality" className="text-xs sm:text-sm">Municipality *</Label>
                    <Select
                      value={formData.municipality}
                      onValueChange={(value) => handleSelectChange("municipality", value)}
                      disabled={!formData.province}
                    >
                      <SelectTrigger className="h-9 sm:h-10 text-sm">
                        <SelectValue placeholder={formData.province ? "Select municipality" : "Select province first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {getMunicipalities().map((municipality) => (
                          <SelectItem key={municipality.id} value={municipality.name}>
                            {municipality.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="barangay" className="text-xs sm:text-sm">Barangay *</Label>
                    <Select
                      value={formData.barangay}
                      onValueChange={(value) => handleSelectChange("barangay", value)}
                      disabled={!formData.municipality}
                    >
                      <SelectTrigger className="h-9 sm:h-10 text-sm">
                        <SelectValue placeholder={formData.municipality ? "Select barangay" : "Select municipality first"} />
                      </SelectTrigger>
                      <SelectContent>
                        {getBarangays().map((barangay) => (
                          <SelectItem key={barangay.id} value={barangay.name}>
                            {barangay.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="contact" className="text-xs sm:text-sm">Contact Number</Label>
                  <Input
                    id="contact"
                    name="contact"
                    value={formData.contact}
                    onChange={handleInputChange}
                    className="h-9 sm:h-10 text-sm"
                  />
                </div>
                <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 sm:gap-3 pt-4">
                  <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); resetForm(); }} className="h-9 sm:h-10">
                    Cancel
                  </Button>
                  <Button type="submit" className="bg-emerald-700 hover:bg-emerald-800 h-9 sm:h-10">
                    {editingBeneficiary ? "Update" : "Add"} Beneficiary
                  </Button>
                </div>
              </form>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      {/* Search and Filters */}
      <Card className="border-stone-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search by HHID, PKNO, or Name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={provinceFilter} onValueChange={(v) => {
                setProvinceFilter(v);
                setMunicipalityFilter("all");
                setBarangayFilter("all");
              }}>
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
                onValueChange={(v) => {
                  setMunicipalityFilter(v);
                  setBarangayFilter("all");
                }}
                disabled={provinceFilter === "all"}
              >
                <SelectTrigger className="w-full sm:w-40 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200">
                  <SelectValue placeholder="Municipality" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Municipalities</SelectItem>
                  {areas
                    .filter(a => a.type === "municipality" && a.parent_id === areas.find(p => p.name === provinceFilter)?.id)
                    .map(m => (
                      <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>

              <Select 
                value={barangayFilter} 
                onValueChange={setBarangayFilter}
                disabled={municipalityFilter === "all"}
              >
                <SelectTrigger className="w-full sm:w-40 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200">
                  <SelectValue placeholder="Barangay" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Barangays</SelectItem>
                  {areas
                    .filter(a => a.type === "barangay" && a.parent_id === areas.find(m => m.name === municipalityFilter)?.id)
                    .map(b => (
                      <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
              
              {(provinceFilter !== "all" || municipalityFilter !== "all" || barangayFilter !== "all") && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setProvinceFilter("all");
                    setMunicipalityFilter("all");
                    setBarangayFilter("all");
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
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-500" />
            Beneficiary List ({filteredBeneficiaries.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="spinner" />
            </div>
          ) : filteredBeneficiaries.length === 0 ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
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
                      onClick={() => handleSort("pkno")}
                    >
                      <div className="flex items-center">
                        PKNO {getSortIcon("pkno")}
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
                    <TableHead className="font-semibold text-slate-600 dark:text-slate-300">Contact</TableHead>
                    {isAdmin && <TableHead className="font-semibold text-slate-600 dark:text-slate-300 text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentItems.map((b) => (
                    <TableRow key={b.id} className="border-b dark:border-slate-800 hover:bg-stone-50 dark:hover:bg-slate-800/30">
                      <TableCell className="font-mono text-sm dark:text-slate-300">{b.hhid}</TableCell>
                      <TableCell className="font-mono text-sm dark:text-slate-300">{b.pkno}</TableCell>
                      <TableCell className="dark:text-slate-300">
                        {b.last_name}, {b.first_name} {b.middle_name}
                      </TableCell>
                      <TableCell className="dark:text-slate-300">{b.barangay}</TableCell>
                      <TableCell className="dark:text-slate-300">{b.municipality}</TableCell>
                      <TableCell className="dark:text-slate-300">{b.province}</TableCell>
                      <TableCell className="dark:text-slate-300">{b.contact || "-"}</TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(b)}
                              className="h-8 w-8 text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-500"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDelete(b.id)}
                              className="h-8 w-8 text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-500"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
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

export default BeneficiariesPage;
