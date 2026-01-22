import { useState, useEffect, useRef } from "react";
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
import { Plus, Search, Edit, Trash2, Users, Download, Upload, ArrowUpDown, ArrowUp, ArrowDown, Trash, AlertTriangle } from "lucide-react";
import * as XLSX from "xlsx";

const BeneficiariesPage = () => {
  const { api, isAdmin, user } = useAuth();
  const fileInputRef = useRef(null);
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [areas, setAreas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState("all");
  const [provinceFilter, setProvinceFilter] = useState("all");
  const [municipalityFilter, setMunicipalityFilter] = useState("all");
  const [barangayFilter, setBarangayFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [is4psFilter, setIs4psFilter] = useState("all");
  const [redemptionStatusFilter, setRedemptionStatusFilter] = useState("all");
  const [frmPeriodFilter, setFrmPeriodFilter] = useState("all");
  const [availablePeriods, setAvailablePeriods] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalBeneficiaries, setTotalBeneficiaries] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortConfig, setSortConfig] = useState({ key: "last_name", direction: "asc" });
  const [selectedIds, setSelectedIds] = useState([]);
  const [debouncedSearch, setDebouncedSearch] = useState("");

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
  }, [debouncedSearch, regionFilter, provinceFilter, municipalityFilter, barangayFilter, statusFilter, is4psFilter, redemptionStatusFilter, frmPeriodFilter, itemsPerPage]);
  const [isAllSelectedGlobally, setIsAllSelectedGlobally] = useState(false);
  const [isDuplicateDialogOpen, setIsDuplicateDialogOpen] = useState(false);
  const [duplicates, setDuplicates] = useState([]);
  const [pendingImportData, setPendingImportData] = useState(null);

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
        // Use bulk-delete endpoint with filters
        await api.post("/beneficiaries/bulk-delete", {
          all: true,
          filters: {
            search,
            region: regionFilter,
            province: provinceFilter,
            municipality: municipalityFilter,
            barangay: barangayFilter,
            status: statusFilter,
            is4ps: is4psFilter,
            redemption_status: redemptionStatusFilter,
            frm_period: frmPeriodFilter
          }
        });
      } else {
        // Use bulk-delete endpoint with specific IDs
        await api.post("/beneficiaries/bulk-delete", {
          ids: selectedIds,
          all: false
        });
      }
      
      toast.dismiss(toastId);
      toast.success(`Successfully deleted ${count} beneficiaries`);
      setSelectedIds([]);
      setIsAllSelectedGlobally(false);
      fetchBeneficiaries();
    } catch (error) {
      toast.dismiss(toastId);
      toast.error("Failed to delete beneficiaries");
      console.error("Bulk delete error:", error);
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
    is4ps: "No",
    status: "Active",
    num_hh_0_18: 0,
    num_hh_pregnant: 0,
    num_hh_lactating: 0,
    num_hh_pwd: 0,
    pwd_types: [],
    num_hh_60_above: 0,
    num_hh_solo_parent: 0,
  });

  const pwdTypesList = [
    "Deaf or Hard of Hearing",
    "Intellectual Disability",
    "Learning Disability",
    "Mental Disability",
    "Physical Disability (Orthopedic)",
    "Psychosocial Disability",
    "Speech and Language Impairment",
    "Visual Disability",
    "Cancer (Special Category)",
    "Rare Disease (Special Category)"
  ];

  const handleAddPwdType = (type) => {
    if (!formData.pwd_types.find(t => t.type === type)) {
      setFormData(prev => ({
        ...prev,
        pwd_types: [...prev.pwd_types, { type, count: 1 }]
      }));
    }
  };

  const handleUpdatePwdTypeCount = (type, count) => {
    setFormData(prev => ({
      ...prev,
      pwd_types: prev.pwd_types.map(t => 
        t.type === type ? { ...t, count: parseInt(count) || 0 } : t
      )
    }));
  };

  const handleRemovePwdType = (type) => {
    setFormData(prev => ({
      ...prev,
      pwd_types: prev.pwd_types.filter(t => t.type !== type)
    }));
  };

  useEffect(() => {
    fetchBeneficiaries();
  }, [currentPage, debouncedSearch, regionFilter, provinceFilter, municipalityFilter, barangayFilter, statusFilter, is4psFilter, redemptionStatusFilter, frmPeriodFilter, sortConfig, itemsPerPage]);

  useEffect(() => {
    fetchAreas("region");
    fetchAvailableFilters();
  }, []);

  const fetchAvailableFilters = async () => {
    try {
      const response = await api.get("/beneficiaries/filters");
      if (response.data.periods && response.data.periods.length > 0) {
        setAvailablePeriods(response.data.periods);
        // Default to latest period if none selected
        if (frmPeriodFilter === "all") {
          setFrmPeriodFilter(response.data.periods[0]);
        }
      }
    } catch (error) {
      console.error("Failed to fetch available filters:", error);
    }
  };

  const fetchAreas = async (type = null, parentId = null, parentCode = null) => {
    try {
      // Don't fetch if all are null to avoid loading all 40,000+ areas
      if (!type && !parentId && !parentCode) return [];

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
      let query = `?page=${currentPage}&limit=${itemsPerPage}&sort=${sortConfig.key}&order=${sortConfig.direction}`;
      if (debouncedSearch) query += `&search=${encodeURIComponent(debouncedSearch)}`;
      if (regionFilter !== "all") query += `&region=${encodeURIComponent(regionFilter)}`;
      if (provinceFilter !== "all") query += `&province=${encodeURIComponent(provinceFilter)}`;
      if (municipalityFilter !== "all") query += `&municipality=${encodeURIComponent(municipalityFilter)}`;
      if (barangayFilter !== "all") query += `&barangay=${encodeURIComponent(barangayFilter)}`;
      if (statusFilter !== "all") query += `&status=${encodeURIComponent(statusFilter)}`;
      if (is4psFilter !== "all") query += `&is4ps=${encodeURIComponent(is4psFilter)}`;
      if (redemptionStatusFilter !== "all") query += `&redemption_status=${encodeURIComponent(redemptionStatusFilter)}`;
      if (frmPeriodFilter !== "all") query += `&frm_period=${encodeURIComponent(frmPeriodFilter)}`;

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
    const { name, value, type } = e.target;
    setFormData((prev) => ({ 
      ...prev, 
      [name]: type === 'number' ? (value === '' ? 0 : parseInt(value)) : value 
    }));
  };

  const handleSelectChange = (name, value) => {
    setFormData((prev) => {
      const newData = { ...prev, [name]: value };
      
      // Reset dependent fields when parent changes
      if (name === "region") {
        newData.province = "";
        newData.municipality = "";
        newData.barangay = "";
        const regionObj = areas.find(a => a.name?.trim().toLowerCase() === value?.trim().toLowerCase() && a.type === "region");
        if (regionObj) fetchAreas("province", regionObj.id, regionObj.code);
      } else if (name === "province") {
        newData.municipality = "";
        newData.barangay = "";
        const regionObj = areas.find(a => a.name?.trim().toLowerCase() === prev.region?.trim().toLowerCase() && a.type === "region");
        const provinceObj = areas.find(a => a.name?.trim().toLowerCase() === value?.trim().toLowerCase() && a.type === "province" && 
          (regionObj ? (a.parent_id === regionObj.id || a.parent_code === regionObj.code) : true));
        if (provinceObj) fetchAreas("municipality", provinceObj.id, provinceObj.code);
      } else if (name === "municipality") {
        newData.barangay = "";
        const regionObj = areas.find(a => a.name?.trim().toLowerCase() === prev.region?.trim().toLowerCase() && a.type === "region");
        const provinceObj = areas.find(a => a.name?.trim().toLowerCase() === prev.province?.trim().toLowerCase() && a.type === "province" &&
          (regionObj ? (a.parent_id === regionObj.id || a.parent_code === regionObj.code) : true));
        const municipalityObj = areas.find(a => a.name?.trim().toLowerCase() === value?.trim().toLowerCase() && a.type === "municipality" && 
          (provinceObj ? (a.parent_id === provinceObj.id || a.parent_code === provinceObj.code) : true));
        if (municipalityObj) fetchAreas("barangay", municipalityObj.id, municipalityObj.code);
      }
      
      return newData;
    });
  };

  const getRegions = () => areas.filter(a => a.type === "region");

  const getProvinces = () => {
    if (!formData.region) return [];
    const region = areas.find(a => a.name?.trim().toLowerCase() === formData.region?.trim().toLowerCase() && a.type === "region");
    if (!region) return [];
    return areas.filter(a => a.type === "province" && (a.parent_id === region.id || a.parent_code === region.code));
  };
  
  const getMunicipalities = () => {
    if (!formData.province) return [];
    const region = areas.find(a => a.name?.trim().toLowerCase() === formData.region?.trim().toLowerCase() && a.type === "region");
    const province = areas.find(a => a.name?.trim().toLowerCase() === formData.province?.trim().toLowerCase() && a.type === "province" &&
      (region ? (a.parent_id === region.id || a.parent_code === region.code) : true)
    );
    if (!province) return [];
    return areas.filter(a => a.type === "municipality" && (a.parent_id === province.id || a.parent_code === province.code));
  };

  const getBarangays = () => {
    if (!formData.municipality) return [];
    const region = areas.find(a => a.name?.trim().toLowerCase() === formData.region?.trim().toLowerCase() && a.type === "region");
    const province = areas.find(a => a.name?.trim().toLowerCase() === formData.province?.trim().toLowerCase() && a.type === "province" &&
      (region ? (a.parent_id === region.id || a.parent_code === region.code) : true)
    );
    const municipality = areas.find(a => a.name?.trim().toLowerCase() === formData.municipality?.trim().toLowerCase() && a.type === "municipality" && 
      (province ? (a.parent_id === province.id || a.parent_code === province.code) : true)
    );
    if (!municipality) return [];
    return areas.filter(a => a.type === "barangay" && (a.parent_id === municipality.id || a.parent_code === municipality.code));
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
      is4ps: "No",
      status: "Active",
      num_hh_0_18: 0,
      num_hh_pregnant: 0,
      num_hh_lactating: 0,
      num_hh_pwd: 0,
      pwd_types: [],
      num_hh_60_above: 0,
      num_hh_solo_parent: 0,
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
    
    // Format birthdate to YYYY-MM-DD for the date input if it's an ISO string or similar
    let formattedBirthdate = beneficiary.birthdate || "";
    if (formattedBirthdate && formattedBirthdate.includes('T')) {
      formattedBirthdate = formattedBirthdate.split('T')[0];
    } else if (formattedBirthdate && formattedBirthdate.includes('/')) {
      // Handle MM/DD/YYYY if necessary
      const parts = formattedBirthdate.split('/');
      if (parts.length === 3) {
        if (parts[2].length === 4) { // YYYY at end
          formattedBirthdate = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
        }
      }
    }

    // Set initial form data
    const initialData = {
      hhid: beneficiary.hhid?.trim(),
      pkno: beneficiary.pkno?.trim(),
      first_name: beneficiary.first_name?.trim(),
      last_name: beneficiary.last_name?.trim(),
      middle_name: beneficiary.middle_name?.trim() || "",
      birthdate: formattedBirthdate,
      gender: normalizeGender(beneficiary.gender),
      barangay: beneficiary.barangay?.trim(),
      municipality: beneficiary.municipality?.trim(),
      province: beneficiary.province?.trim(),
      region: beneficiary.region?.trim() || "",
      contact: beneficiary.contact?.trim() || "",
      is4ps: beneficiary.is4ps || "No",
      status: beneficiary.status || "Active",
      num_hh_0_18: beneficiary.num_hh_0_18 || 0,
      num_hh_pregnant: beneficiary.num_hh_pregnant || 0,
      num_hh_lactating: beneficiary.num_hh_lactating || 0,
      num_hh_pwd: beneficiary.num_hh_pwd || 0,
      pwd_types: beneficiary.pwd_types || [],
      num_hh_60_above: beneficiary.num_hh_60_above || 0,
      num_hh_solo_parent: beneficiary.num_hh_solo_parent || 0,
    };
    setFormData(initialData);

    // Proactively fetch sub-areas for the selected branch and ensure casing matches exactly for Select components
    try {
      if (beneficiary.region) {
        const regions = await fetchAreas("region");
        const regionObj = regions.find(r => r.name?.trim().toLowerCase() === beneficiary.region?.trim().toLowerCase());
        
        if (regionObj) {
          // Update region name to match exact casing from areas collection
          setFormData(prev => ({ ...prev, region: regionObj.name }));
          
          const provinces = await fetchAreas("province", regionObj.id, regionObj.code);
          if (beneficiary.province) {
            const provinceObj = provinces.find(p => p.name?.trim().toLowerCase() === beneficiary.province?.trim().toLowerCase());
            
            if (provinceObj) {
              // Update province name to match exact casing
              setFormData(prev => ({ ...prev, province: provinceObj.name }));
              
              const municipalities = await fetchAreas("municipality", provinceObj.id, provinceObj.code);
              if (beneficiary.municipality) {
                const municipalityObj = municipalities.find(m => m.name?.trim().toLowerCase() === beneficiary.municipality?.trim().toLowerCase());
                
                if (municipalityObj) {
                  // Update municipality name to match exact casing
                  setFormData(prev => ({ ...prev, municipality: municipalityObj.name }));
                  
                  const barangays = await fetchAreas("barangay", municipalityObj.id, municipalityObj.code);
                  if (beneficiary.barangay) {
                    const barangayObj = barangays.find(b => b.name?.trim().toLowerCase() === beneficiary.barangay?.trim().toLowerCase());
                    if (barangayObj) {
                      // Update barangay name to match exact casing
                      setFormData(prev => ({ ...prev, barangay: barangayObj.name }));
                    }
                  }
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

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const processBulkImport = async (data) => {
    const toastId = toast.loading(`Importing ${data.length} beneficiaries (0%)...`);
    try {
      let totalSuccess = 0;
      let totalFailed = 0;
      let allErrors = [];
      const chunkSize = 100;

      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        const progress = Math.round((i / data.length) * 100);
        toast.loading(`Importing ${data.length} beneficiaries (${progress}%)...`, { id: toastId });
        
        const response = await api.post("/beneficiaries/bulk", { beneficiaries: chunk });
        totalSuccess += response.data.success || 0;
        totalFailed += response.data.failed || 0;
        if (response.data.errors) {
          allErrors.push(...response.data.errors);
        }
      }

      toast.dismiss(toastId);
      
      if (totalSuccess > 0) {
        toast.success(`Successfully processed ${totalSuccess} beneficiaries`);
        if (totalFailed > 0) {
          toast.warning(`Failed to process ${totalFailed} records. Check console for details.`);
          console.error("Import errors:", allErrors);
        }
        fetchBeneficiaries();
      } else {
        toast.error("Failed to import beneficiaries. Check file format.");
        console.error("Import errors:", allErrors);
      }
    } catch (error) {
      toast.dismiss(toastId);
      console.error("Import error:", error);
      toast.error(error.response?.data?.message || "Failed to import beneficiaries");
    }
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const extension = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls'].includes(extension)) {
      toast.error("Please upload an Excel file (.xlsx or .xls)");
      event.target.value = '';
      return;
    }

    const toastId = toast.loading("Reading file...");
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (jsonData.length < 2) {
          toast.dismiss(toastId);
          toast.error("File is empty or invalid");
          return;
        }

        const headers = jsonData[0].map(h => String(h || '').trim().toLowerCase());
        const dataRows = jsonData.slice(1);

        const beneficiariesToImport = dataRows.map(row => {
          const b = {};
          headers.forEach((header, index) => {
            const val = String(row[index] || '').trim();
            if (!val) return;

            if (header.includes('hhid')) b.hhid = val;
            else if (header.includes('pkno')) b.pkno = val;
            else if (header.includes('first name') || header === 'first_name') b.first_name = val;
            else if (header.includes('last name') || header === 'last_name') b.last_name = val;
            else if (header.includes('middle name') || header === 'middle_name') b.middle_name = val;
            else if (header.includes('birthdate')) b.birthdate = val;
            else if (header.includes('gender')) b.gender = val;
            else if (header.includes('barangay')) b.barangay = val;
            else if (header.includes('municipality')) b.municipality = val;
            else if (header.includes('province')) b.province = val;
            else if (header.includes('region')) b.region = val;
            else if (header.includes('contact')) b.contact = val;
            else if (header.includes('is4ps')) b.is4ps = val.toLowerCase() === 'yes' || val === 'true' || val === '1';
            else if (header.includes('0-18')) b.num_hh_0_18 = parseInt(val) || 0;
            else if (header.includes('pregnant')) b.num_hh_pregnant = parseInt(val) || 0;
            else if (header.includes('lactating')) b.num_hh_lactating = parseInt(val) || 0;
            else if (header.includes('pwd count')) b.num_hh_pwd = parseInt(val) || 0;
            else if (header.includes('pwd type')) {
              b.pwd_types = val.split(',').map(s => {
                const item = s.trim();
                const match = item.match(/(.+)\s*\((\d+)\)/);
                if (match) {
                  return { type: match[1].trim(), count: parseInt(match[2]) || 1 };
                }
                return { type: item, count: 1 };
              }).filter(t => !!t.type);
            }
            else if (header.includes('60 and above') || header.includes('60+')) b.num_hh_60_above = parseInt(val) || 0;
            else if (header.includes('solo parent')) b.num_hh_solo_parent = parseInt(val) || 0;
          });
          return b;
        }).filter(b => b.first_name && b.last_name);

        if (beneficiariesToImport.length === 0) {
          toast.dismiss(toastId);
          toast.error("No valid beneficiary data found in file");
          return;
        }

        toast.loading("Checking for duplicates (0%)...", { id: toastId });
        
        try {
          const allDuplicates = [];
          const chunkSize = 100; // Check in chunks of 100
          
          for (let i = 0; i < beneficiariesToImport.length; i += chunkSize) {
            const chunk = beneficiariesToImport.slice(i, i + chunkSize);
            const progress = Math.round((i / beneficiariesToImport.length) * 100);
            toast.loading(`Checking for duplicates (${progress}%)...`, { id: toastId });
            
            const dupResponse = await api.post("/beneficiaries/check-duplicates", { beneficiaries: chunk });
            if (dupResponse.data.duplicates) {
              allDuplicates.push(...dupResponse.data.duplicates);
            }
          }
          
          toast.dismiss(toastId);
          
          if (allDuplicates.length > 0) {
            setDuplicates(allDuplicates);
            setPendingImportData(beneficiariesToImport);
            setIsDuplicateDialogOpen(true);
          } else {
            await processBulkImport(beneficiariesToImport);
          }
        } catch (error) {
          toast.dismiss(toastId);
          console.error("Duplicate check error:", error);
          // If duplicate check fails, proceed with caution or ask user
          if (window.confirm("Duplicate check failed. Proceed with import anyway?")) {
            await processBulkImport(beneficiariesToImport);
          }
        }
      } catch (error) {
        toast.dismiss(toastId);
        console.error("File processing error:", error);
        toast.error("Failed to process file");
      } finally {
        event.target.value = '';
      }
    };
    reader.onerror = () => {
      toast.dismiss(toastId);
      toast.error("Failed to read file");
      event.target.value = '';
    };
    reader.readAsArrayBuffer(file);
  };

  const handleExport = async () => {
    try {
      const toastId = toast.loading("Preparing export...");
      
      // Fetch only what is showing in the table (current page and limit)
      let query = `?page=${currentPage}&limit=${itemsPerPage}&sort=${sortConfig.key}&order=${sortConfig.direction}`;
      if (debouncedSearch) query += `&search=${encodeURIComponent(debouncedSearch)}`;
      if (regionFilter !== "all") query += `&region=${encodeURIComponent(regionFilter)}`;
      if (provinceFilter !== "all") query += `&province=${encodeURIComponent(provinceFilter)}`;
      if (municipalityFilter !== "all") query += `&municipality=${encodeURIComponent(municipalityFilter)}`;
      if (barangayFilter !== "all") query += `&barangay=${encodeURIComponent(barangayFilter)}`;
      if (statusFilter !== "all") query += `&status=${encodeURIComponent(statusFilter)}`;
      if (is4psFilter !== "all") query += `&is4ps=${encodeURIComponent(is4psFilter)}`;
      if (redemptionStatusFilter !== "all") query += `&redemption_status=${encodeURIComponent(redemptionStatusFilter)}`;
      if (frmPeriodFilter !== "all") query += `&frm_period=${encodeURIComponent(frmPeriodFilter)}`;
      
      const response = await api.get(`/beneficiaries${query}`);
      const allBeneficiaries = response.data.beneficiaries || [];

      if (allBeneficiaries.length === 0) {
        toast.dismiss(toastId);
        toast.error("No data to export");
        return;
      }

      // Map data for Excel
      const exportData = allBeneficiaries.map(b => ({
        "HHID": b.hhid,
        "PKNO": b.pkno,
        "First Name": b.first_name,
        "Last Name": b.last_name,
        "Middle Name": b.middle_name || "",
        "Birthdate": b.birthdate,
        "Gender": b.gender,
        "Barangay": b.barangay,
        "Municipality": b.municipality,
        "Province": b.province,
        "Region": b.region || "",
        "Contact": b.contact || "",
        "Redeemed": b.redemption_stats?.redeemed || 0,
        "Unredeemed": b.redemption_stats?.unredeemed || 0,
        "Present (NES)": b.nes_stats?.present || 0,
        "Absent (NES)": b.nes_stats?.absent || 0,
        "is4ps": b.is4ps || "No",
        "HH 0-18 yrs": b.num_hh_0_18 || 0,
        "HH Pregnant": b.num_hh_pregnant || 0,
        "HH Lactating": b.num_hh_lactating || 0,
        "HH PWD Count": b.num_hh_pwd || 0,
        "HH PWD Types": (b.pwd_types || []).map(t => `${t.type} (${t.count})`).join(", "),
        "HH 60+ yrs": b.num_hh_60_above || 0,
        "HH Solo Parent": b.num_hh_solo_parent || 0
      }));

      // Create workbook and worksheet
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Beneficiaries");

      // Set column widths for better readability
      const wscols = [
        { wch: 15 }, // HHID
        { wch: 15 }, // PKNO
        { wch: 15 }, // First Name
        { wch: 15 }, // Last Name
        { wch: 15 }, // Middle Name
        { wch: 12 }, // Birthdate
        { wch: 10 }, // Gender
        { wch: 15 }, // Barangay
        { wch: 15 }, // Municipality
        { wch: 15 }, // Province
        { wch: 15 }, // Region
        { wch: 15 }, // Contact
        { wch: 12 }, // Redeemed
        { wch: 12 }, // Unredeemed
        { wch: 12 }, // Present (NES)
        { wch: 12 }, // Absent (NES)
        { wch: 10 }, // is4ps
        { wch: 12 }, // HH 0-18 yrs
        { wch: 12 }, // HH Pregnant
        { wch: 12 }, // HH Lactating
        { wch: 12 }, // HH PWD Count
        { wch: 25 }, // HH PWD Types
        { wch: 12 }, // HH 60+ yrs
        { wch: 12 }, // HH Solo Parent
      ];
      worksheet['!cols'] = wscols;

      // Generate Excel file
      XLSX.writeFile(workbook, `beneficiaries_${new Date().toISOString().split('T')[0]}.xlsx`);
      
      toast.dismiss(toastId);
      toast.success(`Exported ${allBeneficiaries.length} records to Excel`);
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Failed to export data");
    }
  };

  const sortedBeneficiaries = beneficiaries;

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="text-center sm:text-left">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-slate-100">Beneficiaries</h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">Manage program beneficiaries</p>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2">
          {isAdmin && (
            <>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".xlsx, .xls"
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={handleImportClick}
                className="border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 dark:border-blue-500 dark:text-blue-400 text-xs sm:text-sm h-9 sm:h-10"
              >
                <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                Import
              </Button>
              <Button
                variant="outline"
                onClick={handleExport}
                className="border-emerald-600 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 dark:border-emerald-500 dark:text-emerald-400 text-xs sm:text-sm h-9 sm:h-10"
              >
                <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                Export
              </Button>
            </>
          )}

          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
            {isAdmin && (
              <DialogTrigger asChild>
                <Button className="col-span-2 sm:col-auto bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white text-xs sm:text-sm h-9 sm:h-10">
                  <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                  Add Beneficiary
                </Button>
              </DialogTrigger>
            )}
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                  <div className="space-y-1.5">
                    <Label htmlFor="is4ps" className="text-xs sm:text-sm">Is 4Ps? *</Label>
                    <Select
                      value={formData.is4ps}
                      onValueChange={(value) => handleSelectChange("is4ps", value)}
                    >
                      <SelectTrigger className="h-9 sm:h-10 text-sm">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Yes">Yes</SelectItem>
                        <SelectItem value="No">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="status" className="text-xs sm:text-sm">Status *</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) => handleSelectChange("status", value)}
                    >
                      <SelectTrigger className="h-9 sm:h-10 text-sm">
                        <SelectValue placeholder="Select Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                        <SelectItem value="Not for Recording">Not for Recording</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Sectoral Information Section */}
                <div className="pt-4 border-t dark:border-slate-800">
                  <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Sectoral Information</h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="num_hh_0_18" className="text-xs sm:text-sm">Number of HH member aging 0-18 years old</Label>
                      <Input
                        id="num_hh_0_18"
                        name="num_hh_0_18"
                        type="number"
                        min="0"
                        value={formData.num_hh_0_18}
                        onChange={handleInputChange}
                        className="h-9 sm:h-10 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="num_hh_pregnant" className="text-xs sm:text-sm">Number of HH member pregnant</Label>
                      <Input
                        id="num_hh_pregnant"
                        name="num_hh_pregnant"
                        type="number"
                        min="0"
                        value={formData.num_hh_pregnant}
                        onChange={handleInputChange}
                        className="h-9 sm:h-10 text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="num_hh_lactating" className="text-xs sm:text-sm">Number of HH member with lactating mother</Label>
                      <Input
                        id="num_hh_lactating"
                        name="num_hh_lactating"
                        type="number"
                        min="0"
                        value={formData.num_hh_lactating}
                        onChange={handleInputChange}
                        className="h-9 sm:h-10 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="num_hh_pwd" className="text-xs sm:text-sm">Number of HH member with PWD</Label>
                      <Input
                        id="num_hh_pwd"
                        name="num_hh_pwd"
                        type="number"
                        min="0"
                        value={formData.num_hh_pwd}
                        onChange={handleInputChange}
                        className="h-9 sm:h-10 text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 mt-4">
                    <Label className="text-xs sm:text-sm">PWD Types</Label>
                    <Select onValueChange={handleAddPwdType}>
                      <SelectTrigger className="h-9 sm:h-10 text-sm">
                        <SelectValue placeholder="Add PWD type" />
                      </SelectTrigger>
                      <SelectContent>
                        {pwdTypesList.map((type) => (
                          <SelectItem key={type} value={type} disabled={formData.pwd_types.find(t => t.type === type)}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <div className="space-y-2 mt-2">
                      {formData.pwd_types.map((item) => (
                        <div 
                          key={item.type} 
                          className="flex items-center justify-between gap-3 bg-slate-100 dark:bg-slate-800 p-2 rounded text-xs dark:text-slate-300 border dark:border-slate-700"
                        >
                          <span className="flex-1 font-medium">{item.type}</span>
                          <div className="flex items-center gap-2">
                            <Label htmlFor={`count-${item.type}`} className="text-[10px] uppercase text-slate-500">Count:</Label>
                            <Input
                              id={`count-${item.type}`}
                              type="number"
                              min="1"
                              value={item.count}
                              onChange={(e) => handleUpdatePwdTypeCount(item.type, e.target.value)}
                              className="w-16 h-7 text-xs px-2"
                            />
                            <button 
                              type="button" 
                              onClick={() => handleRemovePwdType(item.type)}
                              className="text-slate-500 hover:text-red-500 transition-colors p-1"
                              title="Remove"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                      {formData.pwd_types.length === 0 && (
                        <span className="text-xs text-slate-500 italic">No types added</span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="num_hh_60_above" className="text-xs sm:text-sm">Number of HH member aging 60 and above</Label>
                      <Input
                        id="num_hh_60_above"
                        name="num_hh_60_above"
                        type="number"
                        min="0"
                        value={formData.num_hh_60_above}
                        onChange={handleInputChange}
                        className="h-9 sm:h-10 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="num_hh_solo_parent" className="text-xs sm:text-sm">Number of HH member Solo Parent</Label>
                      <Input
                        id="num_hh_solo_parent"
                        name="num_hh_solo_parent"
                        type="number"
                        min="0"
                        value={formData.num_hh_solo_parent}
                        onChange={handleInputChange}
                        className="h-9 sm:h-10 text-sm"
                      />
                    </div>
                  </div>
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
        </div>

      {/* Search and Filters */}
      <Card className="border-stone-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search by HHID, PKNO, or Name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200"
              />
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Select value={regionFilter} onValueChange={(val) => {
                    setRegionFilter(val);
                    setProvinceFilter("all");
                    setMunicipalityFilter("all");
                    setBarangayFilter("all");
                    const regionObj = areas.find(a => a.name?.trim().toLowerCase() === val?.trim().toLowerCase() && a.type === "region");
                    if (regionObj) fetchAreas("province", regionObj.id, regionObj.code);
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
                    const regionObj = areas.find(a => a.name?.trim().toLowerCase() === regionFilter?.trim().toLowerCase() && a.type === "region");
                    const provinceObj = areas.find(a => a.name?.trim().toLowerCase() === val?.trim().toLowerCase() && a.type === "province" && 
                      (regionObj ? (a.parent_id === regionObj.id || a.parent_code === regionObj.code) : true));
                    if (provinceObj) fetchAreas("municipality", provinceObj.id, provinceObj.code);
                  }}
                  disabled={regionFilter === "all"}
                >
                  <SelectTrigger className="w-full sm:w-40 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200">
                    <SelectValue placeholder="Province" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Provinces</SelectItem>
                    {areas
                      .filter(a => a.type === "province" && (regionFilter !== "all" ? 
                        (() => {
                          const r = areas.find(area => area.name?.trim().toLowerCase() === regionFilter?.trim().toLowerCase() && area.type === "region");
                          return r ? (a.parent_id === r.id || a.parent_code === r.code) : true;
                        })() : true))
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
                    const regionObj = areas.find(a => a.name?.trim().toLowerCase() === regionFilter?.trim().toLowerCase() && a.type === "region");
                    const provinceObj = areas.find(a => a.name?.trim().toLowerCase() === provinceFilter?.trim().toLowerCase() && a.type === "province" &&
                      (regionObj ? (a.parent_id === regionObj.id || a.parent_code === regionObj.code) : true));
                    const municipalityObj = areas.find(a => a.name?.trim().toLowerCase() === val?.trim().toLowerCase() && a.type === "municipality" && 
                      (provinceObj ? (a.parent_id === provinceObj.id || a.parent_code === provinceObj.code) : true));
                    if (municipalityObj) fetchAreas("barangay", municipalityObj.id, municipalityObj.code);
                  }}
                  disabled={provinceFilter === "all"}
                >
                  <SelectTrigger className="w-full sm:w-40 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200">
                    <SelectValue placeholder="Municipality" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Municipalities</SelectItem>
                    {areas
                      .filter(a => a.type === "municipality" && (provinceFilter !== "all" ? 
                        (() => {
                          const r = areas.find(area => area.name?.trim().toLowerCase() === regionFilter?.trim().toLowerCase() && area.type === "region");
                          const p = areas.find(area => area.name?.trim().toLowerCase() === provinceFilter?.trim().toLowerCase() && area.type === "province" &&
                            (r ? (area.parent_id === r.id || area.parent_code === r.code) : true));
                          return p ? (a.parent_id === p.id || a.parent_code === p.code) : true;
                        })() : true))
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
                      .filter(a => a.type === "barangay" && (municipalityFilter !== "all" ? 
                        (() => {
                          const r = areas.find(area => area.name?.trim().toLowerCase() === regionFilter?.trim().toLowerCase() && area.type === "region");
                          const p = areas.find(area => area.name?.trim().toLowerCase() === provinceFilter?.trim().toLowerCase() && area.type === "province" &&
                            (r ? (area.parent_id === r.id || area.parent_code === r.code) : true));
                          const m = areas.find(area => area.name?.trim().toLowerCase() === municipalityFilter?.trim().toLowerCase() && area.type === "municipality" &&
                            (p ? (area.parent_id === p.id || area.parent_code === p.code) : true));
                          return m ? (a.parent_id === m.id || a.parent_code === m.code) : true;
                        })() : true))
                      .map(b => (
                        <SelectItem key={b.id} value={b.name}>{b.name}</SelectItem>
                      ))
                    }
                  </SelectContent>
                </Select>
              </div>

              <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 hidden lg:block" />

              <div className="flex flex-wrap items-center gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-40 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Inactive">Inactive</SelectItem>
                    <SelectItem value="Not for Recording">Not for Recording</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={is4psFilter} onValueChange={setIs4psFilter}>
                  <SelectTrigger className="w-full sm:w-40 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200">
                    <SelectValue placeholder="Is 4Ps" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Members</SelectItem>
                    <SelectItem value="Yes">4Ps Member</SelectItem>
                    <SelectItem value="No">Non-4Ps</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={redemptionStatusFilter} onValueChange={setRedemptionStatusFilter}>
                  <SelectTrigger className="w-full sm:w-40 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200">
                    <SelectValue placeholder="Attendance" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Activity</SelectItem>
                    <SelectItem value="redeemed">Redeemed</SelectItem>
                    <SelectItem value="unredeemed">Unredeemed</SelectItem>
                    <SelectItem value="present">Present</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem>
                  </SelectContent>
                </Select>

                {availablePeriods.length > 0 && (
                  <Select value={frmPeriodFilter} onValueChange={setFrmPeriodFilter}>
                    <SelectTrigger className="w-full sm:w-40 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200">
                      <SelectValue placeholder="FRM Period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Periods</SelectItem>
                      {availablePeriods.map(period => (
                        <SelectItem key={period} value={period}>{period}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 hidden lg:block" />

              <div className="flex items-center gap-2">
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
                
                {(regionFilter !== "all" || provinceFilter !== "all" || municipalityFilter !== "all" || barangayFilter !== "all" || statusFilter !== "all" || is4psFilter !== "all" || redemptionStatusFilter !== "all" || frmPeriodFilter !== "all") && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      setRegionFilter("all");
                      setProvinceFilter("all");
                      setMunicipalityFilter("all");
                      setBarangayFilter("all");
                      setStatusFilter("all");
                      setIs4psFilter("all");
                      setRedemptionStatusFilter("all");
                      setFrmPeriodFilter("all");
                    }}
                    className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                  >
                    Clear
                  </Button>
                )}
              </div>
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
          {isLoading && beneficiaries.length === 0 ? (
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

              <div className="overflow-x-auto relative">
                <Table className="min-w-[1200px]">
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
                        className={`font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-left pl-6 w-[150px]`}
                        onClick={() => handleSort("hhid")}
                      >
                        <div className="flex items-center justify-start">
                          HHID {getSortIcon("hhid")}
                        </div>
                      </TableHead>
                      <TableHead 
                        className={`font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-center hidden md:table-cell w-[120px]`}
                        onClick={() => handleSort("pkno")}
                      >
                        <div className="flex items-center justify-center">
                          PKNO {getSortIcon("pkno")}
                        </div>
                      </TableHead>
                      <TableHead 
                        className={`font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-center w-[200px]`}
                        onClick={() => handleSort("last_name")}
                      >
                        <div className="flex items-center justify-center">
                          Name {getSortIcon("last_name")}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-center hidden lg:table-cell"
                        onClick={() => handleSort("birthdate")}
                      >
                        <div className="flex items-center justify-center">
                          Birthdate {getSortIcon("birthdate")}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-center hidden xl:table-cell"
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
                        className="font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-center hidden 2xl:table-cell"
                        onClick={() => handleSort("region")}
                      >
                        <div className="flex items-center justify-center">
                          Region {getSortIcon("region")}
                        </div>
                      </TableHead>
                      <TableHead 
                        className="font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-center hidden 2xl:table-cell"
                        onClick={() => handleSort("province")}
                      >
                        <div className="flex items-center justify-center">
                          Province {getSortIcon("province")}
                        </div>
                      </TableHead>
                      <TableHead className="font-semibold text-slate-600 dark:text-slate-300 text-center hidden 2xl:table-cell">Contact</TableHead>
                      <TableHead className="font-semibold text-emerald-600 dark:text-emerald-400 text-center hidden lg:table-cell">Redeemed</TableHead>
                      <TableHead className="font-semibold text-amber-600 dark:text-amber-400 text-center hidden lg:table-cell">Unredeemed</TableHead>
                      <TableHead className="font-semibold text-emerald-600 dark:text-emerald-400 text-center hidden xl:table-cell">Present (NES)</TableHead>
                      <TableHead className="font-semibold text-amber-600 dark:text-amber-400 text-center hidden xl:table-cell">Absent (NES)</TableHead>
                      <TableHead className="font-semibold text-slate-600 dark:text-slate-300 text-center hidden md:table-cell">Is 4Ps</TableHead>
                      <TableHead 
                        className="font-semibold text-slate-600 dark:text-slate-300 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-center hidden sm:table-cell"
                        onClick={() => handleSort("status")}
                      >
                        <div className="flex items-center justify-center">
                          Status {getSortIcon("status")}
                        </div>
                      </TableHead>
                      <TableHead className="font-semibold text-slate-600 dark:text-slate-300 text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedBeneficiaries.map((b) => (
                      <TableRow key={b.id} className="group border-b dark:border-slate-800 hover:bg-stone-50 dark:hover:bg-slate-800/30">
                        {isAdmin && (
                          <TableCell className="w-[50px]">
                            <Checkbox 
                              checked={selectedIds.includes(b.id)}
                              onCheckedChange={(checked) => handleSelectOne(b.id, checked)}
                              className="translate-y-[2px] dark:border-slate-700"
                            />
                          </TableCell>
                        )}
                        <TableCell className={`font-mono text-sm dark:text-slate-300 text-left pl-6 w-[150px]`}>
                          {b.hhid}
                        </TableCell>
                        <TableCell className={`font-mono text-sm dark:text-slate-300 text-center hidden md:table-cell w-[120px]`}>
                          {b.pkno}
                        </TableCell>
                        <TableCell className={`dark:text-slate-300 text-center w-[200px]`}>
                          {b.last_name}, {b.first_name} {b.middle_name}
                        </TableCell>
                        <TableCell className="dark:text-slate-300 text-center hidden lg:table-cell">
                          {b.birthdate ? (b.birthdate.includes('T') ? b.birthdate.split('T')[0] : b.birthdate) : "-"}
                        </TableCell>
                        <TableCell className="dark:text-slate-300 text-center hidden xl:table-cell">{b.barangay}</TableCell>
                        <TableCell className="dark:text-slate-300 text-center hidden xl:table-cell">{b.municipality}</TableCell>
                        <TableCell className="dark:text-slate-300 text-center hidden 2xl:table-cell">{b.region}</TableCell>
                        <TableCell className="dark:text-slate-300 text-center hidden 2xl:table-cell">{b.province}</TableCell>
                        <TableCell className="dark:text-slate-300 text-center hidden 2xl:table-cell">{b.contact || "-"}</TableCell>
                        <TableCell className="text-center hidden lg:table-cell">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {b.redemption_stats?.redeemed || 0}
                          </span>
                        </TableCell>
                        <TableCell className="text-center hidden lg:table-cell">
                          <span className="font-bold text-amber-600 dark:text-amber-400">
                            {b.redemption_stats?.unredeemed || 0}
                          </span>
                        </TableCell>
                        <TableCell className="text-center hidden xl:table-cell">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {b.nes_stats?.present || 0}
                          </span>
                        </TableCell>
                        <TableCell className="text-center hidden xl:table-cell">
                          <span className="font-bold text-amber-600 dark:text-amber-400">
                            {b.nes_stats?.absent || 0}
                          </span>
                        </TableCell>
                        <TableCell className="dark:text-slate-300 text-center hidden md:table-cell">
                          <div className="flex justify-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              b.is4ps === "Yes" 
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" 
                                : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
                            }`}>
                              {b.is4ps || "No"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="dark:text-slate-300 text-center hidden sm:table-cell">
                          <div className="flex justify-center">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              b.status === "Active" 
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" 
                                : b.status === "Not for Recording"
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                  : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                            }`}>
                              {b.status || "Active"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(b)}
                              className="h-8 w-8 text-slate-600 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-500"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(b.id)}
                                className="h-8 w-8 text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-500"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

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
            </>
          )}
        </CardContent>
      </Card>
      {/* Duplication Check Dialog */}
      <Dialog open={isDuplicateDialogOpen} onOpenChange={setIsDuplicateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center text-blue-600">
              <Users className="w-5 h-5 mr-2" />
              Existing Beneficiaries Found
            </DialogTitle>
            <DialogDescription>
              We found {duplicates.length} beneficiaries in your file that already exist in the system. 
              Importing will update their information (including is4ps status) instead of creating new records.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 border rounded-md overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50 dark:bg-slate-900">
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Birthdate</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>HHID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {duplicates.map((dup, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">
                      {dup.first_name} {dup.middle_name ? `${dup.middle_name} ` : ''}{dup.last_name}
                    </TableCell>
                    <TableCell>{dup.birthdate}</TableCell>
                    <TableCell>
                      {dup.barangay}, {dup.municipality}, {dup.province}
                    </TableCell>
                    <TableCell className="text-slate-500">{dup.hhid}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter className="mt-6 flex sm:justify-between gap-4">
            <Button
              variant="outline"
              onClick={() => {
                setIsDuplicateDialogOpen(false);
                setPendingImportData(null);
                setDuplicates([]);
              }}
            >
              Cancel Import
            </Button>
            <div className="flex gap-2">
              <Button
                variant="default"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={async () => {
                  setIsDuplicateDialogOpen(false);
                  await processBulkImport(pendingImportData);
                  setPendingImportData(null);
                  setDuplicates([]);
                }}
              >
                Update & Import
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BeneficiariesPage;
