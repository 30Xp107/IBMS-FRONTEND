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
import { Plus, Trash2, MapPin, Building, Home, ArrowUpDown, ArrowUp, ArrowDown, Search } from "lucide-react";

const AreasPage = () => {
  const { api } = useAuth();
  const [areas, setAreas] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [sortConfig, setSortConfig] = useState({ key: "name", direction: "asc" });
  const [formData, setFormData] = useState({
    name: "",
    type: "",
    parent_id: "",
  });

  useEffect(() => {
    fetchAreas();
  }, []);

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
      toast.error("Failed to load areas");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/areas", formData);
      toast.success("Area created successfully");
      fetchAreas();
      setIsDialogOpen(false);
      setFormData({ name: "", type: "", parent_id: "" });
    } catch (error) {
      toast.error(error.response?.data?.detail || "Failed to create area");
    }
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

  const filteredAreas = areas.filter((area) => {
    const matchesSearch = area.name.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter ? area.type === typeFilter : true;
    return matchesSearch && matchesType;
  }).sort((a, b) => {
    const key = sortConfig.key;
    const direction = sortConfig.direction === "asc" ? 1 : -1;
    
    let aValue, bValue;
    
    if (key === "parent_id") {
      aValue = getParentName(a.parent_id).toLowerCase();
      bValue = getParentName(b.parent_id).toLowerCase();
    } else if (key === "createdAt") {
      aValue = new Date(a.createdAt).getTime();
      bValue = new Date(b.createdAt).getTime();
    } else {
      aValue = String(a[key] || "").toLowerCase();
      bValue = String(b[key] || "").toLowerCase();
    }

    if (aValue < bValue) return -1 * direction;
    if (aValue > bValue) return 1 * direction;
    return 0;
  });

  const getTypeIcon = (type) => {
    switch (type) {
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

  const getParentAreas = (type) => {
    if (type === "municipality") {
      return areas.filter((a) => a.type.toLowerCase() === "province");
    } else if (type === "barangay") {
      return areas.filter((a) => a.type.toLowerCase() === "municipality");
    }
    return [];
  };

  const getParentName = (parentId) => {
    if (!parentId) return "-";
    if (typeof parentId === "object" && parentId.name) return parentId.name;
    const parent = areas.find((a) => a.id === parentId);
    return parent?.name || "-";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Area Management</h1>
          <p className="text-slate-500 dark:text-slate-400">Manage provinces, municipalities, and barangays</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Area
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md dark:bg-slate-900 dark:border-slate-800">
            <DialogHeader>
              <DialogTitle className="dark:text-slate-100">Add New Area</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="dark:text-slate-300">Area Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Enter area name"
                  required
                  className="dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type" className="dark:text-slate-300">Area Type *</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, type: value, parent_id: "" }))}
                >
                  <SelectTrigger className="dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200">
                    <SelectValue placeholder="Select area type" />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-slate-900 dark:border-slate-800">
                    <SelectItem value="province">Province</SelectItem>
                    <SelectItem value="municipality">Municipality</SelectItem>
                    <SelectItem value="barangay">Barangay</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(formData.type === "municipality" || formData.type === "barangay") && (
                <div className="space-y-2">
                  <Label htmlFor="parent" className="dark:text-slate-300">Parent Area</Label>
                  <Select
                    value={formData.parent_id}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, parent_id: value }))}
                  >
                    <SelectTrigger className="dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200">
                      <SelectValue placeholder="Select parent area" />
                    </SelectTrigger>
                    <SelectContent className="dark:bg-slate-900 dark:border-slate-800">
                      {getParentAreas(formData.type).map((area) => (
                        <SelectItem key={area.id} value={area.id}>
                          {area.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    setFormData({ name: "", type: "", parent_id: "" });
                  }}
                  className="dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700">
                  Add Area
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
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
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200"
              />
            </div>
            <Select value={typeFilter || "all"} onValueChange={(v) => setTypeFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="w-full sm:w-48 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent className="dark:bg-slate-900 dark:border-slate-800">
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="province">Provinces</SelectItem>
                <SelectItem value="municipality">Municipalities</SelectItem>
                <SelectItem value="barangay">Barangays</SelectItem>
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
            Areas ({filteredAreas.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="spinner" />
            </div>
          ) : filteredAreas.length === 0 ? (
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
                  {filteredAreas.map((area) => (
                    <TableRow key={area.id} className="border-b dark:border-slate-800 hover:bg-stone-50 dark:hover:bg-slate-800/30">
                      <TableCell className="font-medium dark:text-slate-200">{area.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getTypeBadgeColor(area.type)}>
                          {getTypeIcon(area.type)}
                          <span className="ml-1 capitalize">{area.type}</span>
                        </Badge>
                      </TableCell>
                      <TableCell className="dark:text-slate-300">{getParentName(area.parent_id)}</TableCell>
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
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AreasPage;
