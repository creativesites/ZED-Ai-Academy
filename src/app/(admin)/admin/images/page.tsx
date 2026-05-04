"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { SiteAsset } from "@/types/database";
import { 
  Image as ImageIcon, 
  Upload, 
  Link as LinkIcon, 
  RefreshCw,
  Search,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Layout as LayoutIcon,
  Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function AdminImagesPage() {
  const [assets, setAssets] = useState<SiteAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isUploading, setIsUploading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("all");

  const supabase = createClient();

  useEffect(() => {
    fetchAssets();
  }, []);

  async function fetchAssets() {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("site_assets")
      .select("*")
      .order("page", { ascending: true })
      .order("key", { ascending: true });

    if (error) {
      toast.error("Failed to load images");
    } else {
      setAssets(data || []);
    }
    setIsLoading(false);
  }

  async function handleUpdateUrl(id: string, newUrl: string) {
    const { error } = await supabase
      .from("site_assets")
      .update({ url: newUrl, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      toast.error("Update failed");
    } else {
      toast.success("Image URL updated");
      setAssets(assets.map(a => a.id === id ? { ...a, url: newUrl } : a));
    }
  }

  async function handleFileUpload(id: string, file: File) {
    setIsUploading(id);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `site-assets/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(filePath);

      await handleUpdateUrl(id, publicUrl);
    } catch (error: any) {
      toast.error(error.message || "Upload failed");
    } finally {
      setIsUploading(null);
    }
  }

  const pages = useMemo(() => {
    const uniquePages = Array.from(new Set(assets.map(a => a.page)));
    return ["all", ...uniquePages];
  }, [assets]);

  const filteredAssets = assets.filter(a => {
    const matchesSearch = a.key.toLowerCase().includes(search.toLowerCase()) || 
                         a.description?.toLowerCase().includes(search.toLowerCase()) ||
                         a.page.toLowerCase().includes(search.toLowerCase());
    const matchesTab = activeTab === "all" || a.page === activeTab;
    return matchesSearch && matchesTab;
  });

  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div>
          <h1 className="text-4xl font-bold text-[#062e39] tracking-tight">Image Management</h1>
          <p className="text-slate-500 mt-2">Update site-wide visual assets by page and section.</p>
        </div>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input 
            placeholder="Search keys, descriptions..." 
            className="pl-10 rounded-xl bg-white border-slate-200"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="mb-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex items-center gap-4 overflow-x-auto pb-2 scrollbar-hide">
            <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-lg text-slate-500 text-xs font-bold uppercase tracking-wider">
              <Filter className="h-3 w-3" />
              Page Filter
            </div>
            <TabsList className="bg-transparent gap-2 h-auto p-0">
              {pages.map(page => (
                <TabsTrigger 
                  key={page} 
                  value={page}
                  className="rounded-full px-6 py-2 border border-slate-200 data-[state=active]:bg-[#062e39] data-[state=active]:text-white data-[state=active]:border-[#062e39] transition-all capitalize"
                >
                  {page}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <RefreshCw className="h-8 w-8 text-[#fd5523] animate-spin mb-4" />
          <p className="text-slate-500 font-medium">Loading assets...</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {filteredAssets.map((asset) => (
            <Card key={asset.id} className="marketing-card overflow-hidden border-0 rounded-[2.5rem] shadow-xl hover:shadow-2xl transition-all">
              <CardContent className="p-0">
                <div className="grid md:grid-cols-[300px_1fr] min-h-[220px]">
                  {/* Preview Area */}
                  <div className="relative bg-slate-100 flex items-center justify-center overflow-hidden group">
                    {asset.url ? (
                      <img 
                        src={asset.url} 
                        alt={asset.key} 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-slate-300">
                        <ImageIcon className="h-12 w-12" />
                        <span className="text-xs font-bold uppercase tracking-widest">No Image</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <a 
                        href={asset.url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="p-2 bg-white rounded-full text-slate-900 hover:scale-110 transition-transform"
                      >
                        <ExternalLink className="h-5 w-5" />
                      </a>
                    </div>
                  </div>

                  {/* Controls Area */}
                  <div className="p-8 flex flex-col justify-between gap-6">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <h3 className="text-xl font-bold text-[#062e39] font-mono">{asset.key}</h3>
                          <div className="h-2 w-2 rounded-full bg-green-500" />
                        </div>
                        <div className="px-3 py-1 bg-[#fff6ee] text-[#fd5523] text-[10px] font-bold uppercase tracking-widest rounded-full flex items-center gap-1.5">
                          <LayoutIcon className="h-3 w-3" />
                          {asset.page} Page
                        </div>
                      </div>
                      <p className="text-sm text-slate-500 leading-relaxed">{asset.description || "No description provided."}</p>
                    </div>

                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="flex-1 relative">
                          <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <Input 
                            value={asset.url}
                            onChange={(e) => {
                              const newAssets = [...assets];
                              const idx = newAssets.findIndex(a => a.id === asset.id);
                              newAssets[idx].url = e.target.value;
                              setAssets(newAssets);
                            }}
                            onBlur={(e) => handleUpdateUrl(asset.id, e.target.value)}
                            className="pl-10 h-11 bg-slate-50 border-slate-100 rounded-xl text-sm focus:bg-white transition-all"
                            placeholder="https://example.com/image.jpg"
                          />
                        </div>
                        
                        <div className="flex gap-2">
                          <label className="cursor-pointer">
                            <input 
                              type="file" 
                              className="hidden" 
                              accept="image/*"
                              onChange={(e) => e.target.files?.[0] && handleFileUpload(asset.id, e.target.files[0])}
                              disabled={isUploading === asset.id}
                            />
                            <div className={`flex items-center justify-center gap-2 h-11 px-6 rounded-xl border-2 border-slate-100 font-bold text-sm text-[#062e39] hover:bg-slate-50 transition-all ${isUploading === asset.id ? 'opacity-50 pointer-events-none' : ''}`}>
                              {isUploading === asset.id ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <Upload className="h-4 w-4" />
                                  <span>Upload</span>
                                </>
                              )}
                            </div>
                          </label>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between pt-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-300">
                          Last updated: {new Date(asset.updated_at).toLocaleDateString()}
                        </span>
                        <div className="flex items-center gap-4">
                           <span className="flex items-center gap-1.5 text-[10px] font-bold text-green-600 uppercase tracking-widest">
                             <CheckCircle2 className="h-3 w-3" />
                             Sync Active
                           </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {filteredAssets.length === 0 && (
            <div className="text-center py-20 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
              <ImageIcon className="h-12 w-12 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">No images found for this category.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
