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
  DialogDescription,
  DialogFooter,
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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, Search, Edit, Trash2, Users, Download, Upload, ArrowUpDown, ArrowUp, ArrowDown, Trash, Settings } from "lucide-react";
import * as XLSX from "xlsx";

const BeneficiariesPage = () => {
  const { api, isAdmin } = useAuth();
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [areas, setAreas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState("all");
  const [provinceFilter, setProvinceFilter] = useState("all");
  const [municipalityFilter, setMunicipalityFilter] = useState("all");
  const [barangayFilter, setBarangayFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalBeneficiaries, setTotalBeneficiaries] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const itemsPerPage = 10;
  const [sortConfig, setSortConfig] = useState({ key: "last_name", direction: "asc" });
  const [selectedIds, setSelectedIds] = useState([]);
  const [isAllSelectedGlobally, setIsAllSelectedGlobally] = useState(false);

  // Import Preview State
  const [importPreviewData, setImportPreviewData] = useState(null);
  const [isImportPreviewOpen, setIsImportPreviewOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Import Requirements State
  const [importRequirements, setImportRequirements] = useState({
    hhid: true,
    pkno: true,
    first_name: true,
    last_name: true,
    birthdate: false,
    gender: false,
    barangay: false,
    municipality: false,
    province: false,
    region: false,
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const handleSort = (key) => {
    let direction = "asc";
    if (sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedIds(beneficiaries.map(b => b.id));
    } else {
      setSelectedIds([]);
      setIsAllSelectedGlobally(false);
    }
  };

  const handleSelectOne = (id, checked) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
      setIsAllSelectedGlobally(false);
    }
  };

  const handleBulkDelete = async () => {
    const count = isAllSelectedGlobally ? totalBeneficiaries : selectedIds.length;
    if (count === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${count} beneficiaries? This action cannot be undone.`)) return;

    const toastId = toast.loading(`Deleting ${count} beneficiaries...`);
    try {
      if (isAllSelectedGlobally) {
        // Fetch all IDs matching current filters
        let query = `?limit=all`;
        if (search) query += `&search=${search}`;
        if (regionFilter !== "all") query += `&region=${regionFilter}`;
        if (provinceFilter !== "all") query += `&province=${provinceFilter}`;
        if (municipalityFilter !== "all") query += `&municipality=${municipalityFilter}`;
        if (barangayFilter !== "all") query += `&barangay=${barangayFilter}`;
        
        const response = await api.get(`/beneficiaries${query}`);
        const allToDelele = response.data.beneficiaries || [];
        
        for (const b of allToDelele) {
          await api.delete(`/beneficiaries/${b._id || b.id}`);
        }
      } else {
        for (const id of selectedIds) {
          await api.delete(`/beneficiaries/${id}`);
        }
      }
      
      toast.dismiss(toastId);
      toast.success(`Successfully deleted ${count} beneficiaries`);
      setSelectedIds([]);
      setIsAllSelectedGlobally(false);
      fetchBeneficiaries();
    } catch (error) {
      toast.dismiss(toastId);
      toast.error("Failed to delete some beneficiaries");
    }
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
    region: "",
    contact: "",
  });

  useEffect(() => {
    fetchBeneficiaries();
  }, [currentPage, search, regionFilter, provinceFilter, municipalityFilter, barangayFilter]);

  useEffect(() => {
    fetchAreas("region");
    fetchImportRequirements();
  }, []);

  const fetchImportRequirements = async () => {
    try {
      const response = await api.get("/system-configs/beneficiary_import_requirements");
      if (response.data && response.data.value) {
        setImportRequirements(response.data.value);
      }
    } catch (error) {
      console.error("Failed to fetch import requirements:", error);
    }
  };

  const saveImportRequirements = async () => {
    setIsSavingSettings(true);
    try {
      await api.put("/system-configs/beneficiary_import_requirements", {
        value: importRequirements
      });
      toast.success("Import requirements updated successfully");
      setIsSettingsOpen(false);
    } catch (error) {
      toast.error("Failed to update import requirements");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const fetchAreas = async (type = null, parentId = null) => {
    try {
      // Don't fetch if both are null to avoid loading all 40,000+ areas
      if (!type && !parentId) return [];

      let query = `?limit=500`; // Use a large enough limit for any single level
      if (type && parentId) {
        query += `&type=${type}&parent_id=${parentId}`;
      } else if (type) {
        query += `&type=${type}`;
      } else if (parentId) {
        query += `&parent_id=${parentId}`;
      }

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
      return normalizedData;
    } catch (error) {
      console.error("Failed to load areas");
      return [];
    }
  };

  const normalizeGender = (gender) => {
    if (!gender) return "";
    const g = gender.toLowerCase().trim();
    if (g === "m" || g === "male") return "male";
    if (g === "f" || g === "female") return "female";
    return "";
  };

  const fetchBeneficiaries = async () => {
    setIsLoading(true);
    try {
      let query = `?page=${currentPage}&limit=${itemsPerPage}`;
      if (search) query += `&search=${search}`;
      if (regionFilter !== "all") query += `&region=${regionFilter}`;
      if (provinceFilter !== "all") query += `&province=${provinceFilter}`;
      if (municipalityFilter !== "all") query += `&municipality=${municipalityFilter}`;
      if (barangayFilter !== "all") query += `&barangay=${barangayFilter}`;

      const response = await api.get(`/beneficiaries${query}`);
      const data = response.data;
      const normalizedData = (data.beneficiaries || []).map(b => ({
        ...b,
        id: String(b._id || b.id)
      }));
      setBeneficiaries(normalizedData);
      setTotalBeneficiaries(data.total || 0);
      setTotalPages(data.totalPages || 1);
      setSelectedIds([]); // Clear selection when data changes
      setIsAllSelectedGlobally(false);
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
      if (name === "region") {
        newData.province = "";
        newData.municipality = "";
        newData.barangay = "";
        const regionObj = areas.find(a => a.name === value && a.type === "region");
        if (regionObj) fetchAreas("province", regionObj.id);
      } else if (name === "province") {
        newData.municipality = "";
        newData.barangay = "";
        const regionObj = areas.find(a => a.name === prev.region && a.type === "region");
        const provinceObj = areas.find(a => a.name === value && a.type === "province" && (regionObj ? a.parent_id === regionObj.id : true));
        if (provinceObj) fetchAreas("municipality", provinceObj.id);
      } else if (name === "municipality") {
        newData.barangay = "";
        const regionObj = areas.find(a => a.name === prev.region && a.type === "region");
        const provinceObj = areas.find(a => a.name === prev.province && a.type === "province" && (regionObj ? a.parent_id === regionObj.id : true));
        const municipalityObj = areas.find(a => a.name === value && a.type === "municipality" && (provinceObj ? a.parent_id === provinceObj.id : true));
        if (municipalityObj) fetchAreas("barangay", municipalityObj.id);
      }
      
      return newData;
    });
  };

  const getRegions = () => areas.filter(a => a.type === "region");

  const getProvinces = () => {
    if (!formData.region) return [];
    const region = areas.find(a => a.name === formData.region && a.type === "region");
    if (!region) return [];
    return areas.filter(a => a.type === "province" && a.parent_id === region.id);
  };
  
  const getMunicipalities = () => {
    if (!formData.province) return [];
    const province = areas.find(a => a.name === formData.province && a.type === "province" &&
      (formData.region ? a.parent_id === areas.find(r => r.name === formData.region && r.type === "region")?.id : true)
    );
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
      region: "",
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

  const handleEdit = async (beneficiary) => {
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
      region: beneficiary.region || "",
      contact: beneficiary.contact || "",
    });

    // Proactively fetch sub-areas for the selected branch
    try {
      if (beneficiary.region) {
        const regions = await fetchAreas("region");
        const regionObj = regions.find(r => r.name === beneficiary.region);
        if (regionObj) {
          const provinces = await fetchAreas("province", regionObj.id);
          if (beneficiary.province) {
            const provinceObj = provinces.find(p => p.name === beneficiary.province);
            if (provinceObj) {
              const municipalities = await fetchAreas("municipality", provinceObj.id);
              if (beneficiary.municipality) {
                const municipalityObj = municipalities.find(m => m.name === beneficiary.municipality);
                if (municipalityObj) {
                  await fetchAreas("barangay", municipalityObj.id);
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch sub-areas for editing:", error);
    }

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

  const handleExport = async () => {
    try {
      const toastId = toast.loading("Preparing export...");
      
      // Fetch all beneficiaries with current filters but no pagination
      let query = `?limit=all`;
      if (search) query += `&search=${search}`;
      if (regionFilter !== "all") query += `&region=${regionFilter}`;
      if (provinceFilter !== "all") query += `&province=${provinceFilter}`;
      if (municipalityFilter !== "all") query += `&municipality=${municipalityFilter}`;
      if (barangayFilter !== "all") query += `&barangay=${barangayFilter}`;
      
      const response = await api.get(`/beneficiaries${query}`);
      const allBeneficiaries = response.data.beneficiaries || [];

      if (allBeneficiaries.length === 0) {
        toast.dismiss(toastId);
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
        "Region",
        "Contact"
      ];

      const csvContent = [
        headers.join(","),
        ...allBeneficiaries.map(b => [
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
          `"${b.region || ""}"`,
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
              region: getColVal(["Region"]),
              contact: getColVal(["Contact", "Phone"])
            };
          })
          .filter(b => b !== null);

        // Basic validation using dynamic requirements
        const invalidRows = mappedData.filter(b => {
          for (const [field, isRequired] of Object.entries(importRequirements)) {
            if (isRequired && !b[field]) return true;
          }
          return false;
        });
        
        if (invalidRows.length > 0) {
          // Find out which specific field is missing to help the user
          const sample = invalidRows[0];
          let missing = [];
          for (const [field, isRequired] of Object.entries(importRequirements)) {
            if (isRequired && !sample[field]) {
              // Format field name for display
              const label = field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
              missing.push(label);
            }
          }
          
          toast.error(`Invalid data in ${invalidRows.length} rows. Missing required fields: ${missing.join(", ")}`);
          return;
        }

        const loadingToast = toast.loading("Checking for duplicates...");
        
        try {
          // 1. Check for internal duplicates in the file
          const hhidCounts = {};
          const internalDuplicates = [];
          mappedData.forEach(b => {
            hhidCounts[b.hhid] = (hhidCounts[b.hhid] || 0) + 1;
            if (hhidCounts[b.hhid] === 2) {
              internalDuplicates.push(b.hhid);
            }
          });

          // 2. Check for existing duplicates in the database
          const hhids = mappedData.map(b => b.hhid);
          const response = await api.post("/beneficiaries/check-duplicates", { hhids });
          const dbDuplicates = response.data.duplicates || [];
          const dbDuplicateHhids = dbDuplicates.map(d => d.hhid);

          toast.dismiss(loadingToast);

          if (internalDuplicates.length > 0 || dbDuplicateHhids.length > 0) {
            setImportPreviewData({
              total: mappedData.length,
              allData: mappedData,
              internalDuplicates,
              dbDuplicates: dbDuplicateHhids,
              dbDuplicateDetails: dbDuplicates
            });
            setIsImportPreviewOpen(true);
          } else {
            // No duplicates, proceed with import
            await proceedWithImport(mappedData);
          }
        } catch (error) {
          toast.dismiss(loadingToast);
          toast.error("Failed to check for duplicates");
        }
      } catch (error) {
        console.error("Error parsing file:", error);
        toast.error("Error parsing file. Please ensure it's a valid Excel or CSV file.");
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = null;
  };

  const proceedWithImport = async (dataToImport) => {
    setIsImporting(true);
    const loadingToast = toast.loading(`Importing ${dataToImport.length} beneficiaries...`);
    
    try {
      let successCount = 0;
      let errorCount = 0;
      
      for (const beneficiary of dataToImport) {
        try {
          await api.post("/beneficiaries", beneficiary);
          successCount++;
        } catch (err) {
          console.error(`Failed to import beneficiary ${beneficiary.hhid}:`, err);
          errorCount++;
        }
      }

      toast.dismiss(loadingToast);
      if (errorCount === 0) {
        toast.success(`Successfully imported all ${successCount} beneficiaries`);
      } else {
        toast.success(`Imported ${successCount} beneficiaries. ${errorCount} failed.`);
      }
      setIsImportPreviewOpen(false);
      setImportPreviewData(null);
      fetchBeneficiaries();
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error("Failed to import beneficiaries");
    } finally {
      setIsImporting(false);
    }
  };

  // Sort beneficiaries on the client side for the current page
  const sortedBeneficiaries = [...beneficiaries].sort((a, b) => {
    const key = sortConfig.key;
    const direction = sortConfig.direction === "asc" ? 1 : -1;
    
    const aValue = String(a[key] || "").toLowerCase();
    const bValue = String(b[key] || "").toLowerCase();

    if (aValue < bValue) return -1 * direction;
    if (aValue > bValue) return 1 * direction;
    return 0;
  });

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

            {user?.role === "admin" && (
              <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    className="border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 text-xs sm:text-sm h-9 sm:h-10"
                  >
                    <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                    Import Settings
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[95vw] sm:max-w-md dark:bg-slate-900 dark:border-slate-800 p-4 sm:p-6">
                  <DialogHeader>
                    <DialogTitle className="dark:text-slate-100 text-lg sm:text-xl">Import Requirements</DialogTitle>
                    <DialogDescription className="dark:text-slate-400">
                      Toggle which fields are required during beneficiary import.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="grid gap-4">
                      {Object.keys(importRequirements).map((field) => (
                        <div key={field} className="flex items-center justify-between space-x-2">
                          <Label htmlFor={`req-${field}`} className="capitalize">
                            {field.replace(/_/g, ' ')}
                          </Label>
                          <Checkbox
                            id={`req-${field}`}
                            checked={importRequirements[field]}
                            onCheckedChange={(checked) => {
                              setImportRequirements(prev => ({
                                ...prev,
                                [field]: !!checked
                              }));
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>Cancel</Button>
                    <Button 
                      className="bg-emerald-600 hover:bg-emerald-700" 
                      onClick={saveImportRequirements}
                      disabled={isSavingSettings}
                    >
                      {isSavingSettings ? "Saving..." : "Save Changes"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}

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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="region" className="text-xs sm:text-sm">Region *</Label>
                    <Select
                      value={formData.region}
                      onValueChange={(value) => handleSelectChange("region", value)}
                    >
                      <SelectTrigger className="h-9 sm:h-10 text-sm">
                        <SelectValue placeholder="Select region" />
                      </SelectTrigger>
                      <SelectContent>
                        {getRegions().map((region) => (
                          <SelectItem key={region.id} value={region.name}>
                            {region.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="province" className="text-xs sm:text-sm">Province *</Label>
                    <Select
                      value={formData.province}
                      onValueChange={(value) => handleSelectChange("province", value)}
                      disabled={!formData.region}
                    >
                      <SelectTrigger className="h-9 sm:h-10 text-sm">
                        <SelectValue placeholder={formData.region ? "Select province" : "Select region first"} />
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
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              <Select value={regionFilter} onValueChange={(val) => {
                setRegionFilter(val);
                setProvinceFilter("all");
                setMunicipalityFilter("all");
                setBarangayFilter("all");
                const regionObj = areas.find(a => a.name === val && a.type === "region");
                if (regionObj) fetchAreas("province", regionObj.id);
              }}>
                <SelectTrigger className="w-full sm:w-40 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200">
                  <SelectValue placeholder="Region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Regions</SelectItem>
                  {areas
                    .filter(a => a.type === "region")
                    .map(r => (
                      <SelectItem key={r.id} value={r.name}>{r.name}</SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>

              <Select 
                value={provinceFilter} 
                onValueChange={(val) => {
                  setProvinceFilter(val);
                  setMunicipalityFilter("all");
                  setBarangayFilter("all");
                  const regionObj = areas.find(a => a.name === regionFilter && a.type === "region");
                  const provinceObj = areas.find(a => a.name === val && a.type === "province" && (regionObj ? a.parent_id === regionObj.id : true));
                  if (provinceObj) fetchAreas("municipality", provinceObj.id);
                }}
                disabled={regionFilter === "all"}
              >
                <SelectTrigger className="w-full sm:w-40 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200">
                  <SelectValue placeholder="Province" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Provinces</SelectItem>
                  {areas
                    .filter(a => a.type === "province" && (regionFilter !== "all" ? a.parent_id === areas.find(r => r.name === regionFilter)?.id : true))
                    .map(p => (
                      <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>

              <Select 
                value={municipalityFilter} 
                onValueChange={(val) => {
                  setMunicipalityFilter(val);
                  setBarangayFilter("all");
                  const regionObj = areas.find(a => a.name === regionFilter && a.type === "region");
                  const provinceObj = areas.find(a => a.name === provinceFilter && a.type === "province" && (regionObj ? a.parent_id === regionObj.id : true));
                  const municipalityObj = areas.find(a => a.name === val && a.type === "municipality" && (provinceObj ? a.parent_id === provinceObj.id : true));
                  if (municipalityObj) fetchAreas("barangay", municipalityObj.id);
                }}
                disabled={provinceFilter === "all"}
              >
                <SelectTrigger className="w-full sm:w-40 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200">
                  <SelectValue placeholder="Municipality" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Municipalities</SelectItem>
                  {areas
                    .filter(a => a.type === "municipality" && (provinceFilter !== "all" ? a.parent_id === areas.find(p => p.name === provinceFilter)?.id : true))
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
                    .filter(a => a.type === "barangay" && (municipalityFilter !== "all" ? a.parent_id === areas.find(m => m.name === municipalityFilter)?.id : true))
                    .map(b => (
                      <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
              
              {(regionFilter !== "all" || provinceFilter !== "all" || municipalityFilter !== "all" || barangayFilter !== "all") && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    setRegionFilter("all");
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-500" />
              Beneficiary List ({totalBeneficiaries})
            </CardTitle>
            
            {isAdmin && selectedIds.length > 0 && (
              <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-lg border border-emerald-100 dark:border-emerald-800 animate-in fade-in slide-in-from-top-2">
                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  {isAllSelectedGlobally ? totalBeneficiaries : selectedIds.length} selected
                </span>
                <div className="h-4 w-px bg-emerald-200 dark:bg-emerald-800 mx-1" />
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center h-7 px-2 text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                >
                  <Trash className="w-3.5 h-3.5 mr-1" />
                  Delete
                </button>
                <button
                  onClick={() => setSelectedIds([])}
                  className="h-7 px-2 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : beneficiaries.length === 0 ? (
            <div className="text-center py-12 text-slate-500 dark:text-slate-400">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No beneficiaries found</p>
            </div>
          ) : (
            <>
              {/* Global Selection Banner */}
              {isAdmin && selectedIds.length === beneficiaries.length && totalBeneficiaries > beneficiaries.length && (
                <div className="bg-emerald-50 dark:bg-emerald-900/10 border-b border-emerald-100 dark:border-emerald-800/50 py-2 px-4 text-center">
                  {isAllSelectedGlobally ? (
                    <p className="text-sm text-emerald-700 dark:text-emerald-400">
                      All {totalBeneficiaries} beneficiaries are selected.{" "}
                      <button 
                        onClick={() => {
                          setSelectedIds([]);
                          setIsAllSelectedGlobally(false);
                        }}
                        className="font-semibold underline hover:text-emerald-800 dark:hover:text-emerald-300"
                      >
                        Clear selection
                      </button>
                    </p>
                  ) : (
                    <p className="text-sm text-emerald-700 dark:text-emerald-400">
                      All {beneficiaries.length} beneficiaries on this page are selected.{" "}
                      <button 
                        onClick={() => setIsAllSelectedGlobally(true)}
                        className="font-semibold underline hover:text-emerald-800 dark:hover:text-emerald-300"
                      >
                        Select all {totalBeneficiaries} beneficiaries
                      </button>
                    </p>
                  )}
                </div>
              )}

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-stone-100 dark:bg-slate-800/50 hover:bg-stone-100 dark:hover:bg-slate-800/50 border-b dark:border-slate-800">
                      {isAdmin && (
                        <TableHead className="w-[50px]">
                          <Checkbox 
                            checked={beneficiaries.length > 0 && selectedIds.length === beneficiaries.length}
                            onCheckedChange={handleSelectAll}
                            className="translate-y-[2px] dark:border-slate-700"
                          />
                        </TableHead>
                      )}
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
                        onClick={() => handleSort("region")}
                      >
                        <div className="flex items-center">
                          Region {getSortIcon("region")}
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
                    {sortedBeneficiaries.map((b) => (
                      <TableRow key={b.id} className="border-b dark:border-slate-800 hover:bg-stone-50 dark:hover:bg-slate-800/30">
                        {isAdmin && (
                          <TableCell>
                            <Checkbox 
                              checked={selectedIds.includes(b.id)}
                              onCheckedChange={(checked) => handleSelectOne(b.id, checked)}
                              className="translate-y-[2px] dark:border-slate-700"
                            />
                          </TableCell>
                        )}
                        <TableCell className="font-mono text-sm dark:text-slate-300">{b.hhid}</TableCell>
                        <TableCell className="font-mono text-sm dark:text-slate-300">{b.pkno}</TableCell>
                        <TableCell className="dark:text-slate-300">
                          {b.last_name}, {b.first_name} {b.middle_name}
                        </TableCell>
                        <TableCell className="dark:text-slate-300">{b.barangay}</TableCell>
                        <TableCell className="dark:text-slate-300">{b.municipality}</TableCell>
                        <TableCell className="dark:text-slate-300">{b.region}</TableCell>
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
            </>
          )}
        </CardContent>
      </Card>

      {/* Import Preview Dialog */}
      <Dialog open={isImportPreviewOpen} onOpenChange={(open) => { if (!isImporting) setIsImportPreviewOpen(open); }}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto dark:bg-slate-900 dark:border-slate-800 p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="dark:text-slate-100 text-lg sm:text-xl flex items-center gap-2">
              <Upload className="w-5 h-5 text-blue-600" />
              Import Preview & Duplicate Check
            </DialogTitle>
          </DialogHeader>

          {importPreviewData && (
            <div className="space-y-6 mt-4">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border dark:border-slate-700 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Total records in file:</span>
                  <span className="font-semibold">{importPreviewData.total}</span>
                </div>
                {importPreviewData.internalDuplicates.length > 0 && (
                  <div className="flex justify-between text-sm text-amber-600 dark:text-amber-400">
                    <span>Duplicates within file (HHID):</span>
                    <span className="font-semibold">{importPreviewData.internalDuplicates.length}</span>
                  </div>
                )}
                {importPreviewData.dbDuplicates.length > 0 && (
                  <div className="flex justify-between text-sm text-rose-600 dark:text-rose-400">
                    <span>Already exists in database:</span>
                    <span className="font-semibold">{importPreviewData.dbDuplicates.length}</span>
                  </div>
                )}
                <div className="pt-2 border-t dark:border-slate-700 flex justify-between text-sm font-bold">
                  <span>New records to be added:</span>
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {importPreviewData.allData.filter(b => 
                      !importPreviewData.internalDuplicates.includes(b.hhid) && 
                      !importPreviewData.dbDuplicates.includes(b.hhid)
                    ).length}
                  </span>
                </div>
              </div>

              {(importPreviewData.dbDuplicates.length > 0 || importPreviewData.internalDuplicates.length > 0) && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Duplicate Details</h3>
                  <div className="max-h-40 overflow-y-auto border dark:border-slate-700 rounded-md">
                    <Table>
                      <TableHeader className="sticky top-0 bg-slate-100 dark:bg-slate-800">
                        <TableRow>
                          <TableHead className="text-xs">HHID</TableHead>
                          <TableHead className="text-xs">Type</TableHead>
                          <TableHead className="text-xs">Issue</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importPreviewData.internalDuplicates.map(hhid => (
                          <TableRow key={`int-${hhid}`}>
                            <TableCell className="text-xs py-2 font-mono">{hhid}</TableCell>
                            <TableCell className="text-xs py-2">
                              <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">File</span>
                            </TableCell>
                            <TableCell className="text-xs py-2 text-amber-600">Duplicate in file</TableCell>
                          </TableRow>
                        ))}
                        {importPreviewData.dbDuplicateDetails.map(d => (
                          <TableRow key={`db-${d.hhid}`}>
                            <TableCell className="text-xs py-2 font-mono">{d.hhid}</TableCell>
                            <TableCell className="text-xs py-2">
                              <span className="px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400">System</span>
                            </TableCell>
                            <TableCell className="text-xs py-2 text-rose-600">Already exists: {d.first_name} {d.last_name}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md border border-blue-100 dark:border-blue-800/50">
                <p className="text-xs text-blue-700 dark:text-blue-400">
                  <strong>Recommendation:</strong> Only unique records that don't already exist in the system will be imported if you choose "Import Unique Only".
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t dark:border-slate-800">
                <Button 
                  variant="outline" 
                  className="flex-1 dark:border-slate-700" 
                  onClick={() => { setIsImportPreviewOpen(false); setImportPreviewData(null); }}
                  disabled={isImporting}
                >
                  Cancel
                </Button>
                <Button 
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={() => {
                    const uniqueData = importPreviewData.allData.filter(b => 
                      !importPreviewData.internalDuplicates.includes(b.hhid) && 
                      !importPreviewData.dbDuplicates.includes(b.hhid)
                    );
                    proceedWithImport(uniqueData);
                  }}
                  disabled={isImporting || importPreviewData.allData.filter(b => 
                    !importPreviewData.internalDuplicates.includes(b.hhid) && 
                    !importPreviewData.dbDuplicates.includes(b.hhid)
                  ).length === 0}
                >
                  Import Unique Only
                </Button>
                <Button 
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => proceedWithImport(importPreviewData.allData)}
                  disabled={isImporting}
                >
                  Import All Anyway
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BeneficiariesPage;
