import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  useAllStreamingServers, 
  useCreateStreamingServer, 
  useUpdateStreamingServer, 
  useDeleteStreamingServer,
  StreamingServer 
} from "@/hooks/useStreamingServers";
import {
  useSavedStreamingServers,
  useCreateSavedStreamingServer,
  useUpdateSavedStreamingServer,
  useDeleteSavedStreamingServer,
  SavedStreamingServer
} from "@/hooks/useSavedStreamingServers";
import { Match } from "@/hooks/useSportsData";
import { Plus, Edit2, Trash2, Tv, Loader2, ExternalLink, Play, Search, BookmarkPlus, Library, Copy, FileText, ArrowUp, ArrowDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import HeaderEditor, { HeaderItem, headersToServerForm, serverFormToHeaders } from "@/components/HeaderEditor";

interface StreamingServersManagerProps {
  match: Match;
  onClose: () => void;
}

type ServerFormType = {
  server_name: string;
  server_url: string;
  server_type: 'iframe' | 'm3u8' | 'embed' | 'iframe_to_m3u8';
  display_order: number;
  is_active: boolean;
  referer_value: string;
  origin_value: string;
  cookie_value: string;
  user_agent: string;
  ad_block_enabled: boolean;
  notes: string;
};

const defaultServerForm: ServerFormType = {
  server_name: '',
  server_url: '',
  server_type: 'iframe',
  display_order: 0,
  is_active: true,
  referer_value: '',
  origin_value: '',
  cookie_value: '',
  user_agent: '',
  ad_block_enabled: false,
  notes: '',
};


const StreamingServersManager = ({ match, onClose }: StreamingServersManagerProps) => {
  const { toast } = useToast();
  const { data: servers, isLoading } = useAllStreamingServers(match.id);
  const createServer = useCreateStreamingServer();
  const updateServer = useUpdateStreamingServer();
  const deleteServer = useDeleteStreamingServer();

  // Saved servers hooks
  const [savedSearchQuery, setSavedSearchQuery] = useState('');
  const { data: savedServers, isLoading: savedLoading } = useSavedStreamingServers(savedSearchQuery);
  const createSavedServer = useCreateSavedStreamingServer();
  const updateSavedServer = useUpdateSavedStreamingServer();
  const deleteSavedServer = useDeleteSavedStreamingServer();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [savedDialogOpen, setSavedDialogOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<StreamingServer | null>(null);
  const [editingSavedServer, setEditingSavedServer] = useState<SavedStreamingServer | null>(null);
  const [activeTab, setActiveTab] = useState<'servers' | 'saved'>('servers');
  const [serverForm, setServerForm] = useState<ServerFormType>({ ...defaultServerForm });
  const [formHeaders, setFormHeaders] = useState<HeaderItem[]>([]);

  const resetForm = () => {
    setEditingServer(null);
    setServerForm({ ...defaultServerForm });
    setFormHeaders([]);
  };

  const resetSavedForm = () => {
    setEditingSavedServer(null);
    setServerForm({ ...defaultServerForm });
    setFormHeaders([]);
  };

  const handleEdit = (server: StreamingServer) => {
    setEditingServer(server);
    setServerForm({
      server_name: server.server_name,
      server_url: server.server_url,
      server_type: server.server_type,
      display_order: server.display_order,
      is_active: server.is_active,
      referer_value: server.referer_value || '',
      origin_value: server.origin_value || '',
      cookie_value: server.cookie_value || '',
      user_agent: server.user_agent || '',
      ad_block_enabled: server.ad_block_enabled || false,
      notes: '',
    });
    setFormHeaders(serverFormToHeaders({
      referer_value: server.referer_value || '',
      origin_value: server.origin_value || '',
      cookie_value: server.cookie_value || '',
      user_agent: server.user_agent || '',
    }));
    setDialogOpen(true);
  };

  const handleEditSaved = (saved: SavedStreamingServer) => {
    setEditingSavedServer(saved);
    const serverType = (saved.server_type === 'mpd' ? 'm3u8' : saved.server_type) as 'iframe' | 'm3u8' | 'embed';
    setServerForm({
      server_name: saved.server_name,
      server_url: saved.server_url,
      server_type: serverType,
      display_order: 0,
      is_active: true,
      referer_value: saved.referer_value || '',
      origin_value: saved.origin_value || '',
      cookie_value: saved.cookie_value || '',
      user_agent: saved.user_agent || '',
      ad_block_enabled: saved.ad_block_enabled || false,
      notes: saved.notes || '',
    });
    setFormHeaders(serverFormToHeaders({
      referer_value: saved.referer_value || '',
      origin_value: saved.origin_value || '',
      cookie_value: saved.cookie_value || '',
      user_agent: saved.user_agent || '',
    }));
    setSavedDialogOpen(true);
  };

  const handleSave = async () => {
    if (!serverForm.server_name || !serverForm.server_url) {
      toast({ title: "Error", description: "Server name and URL are required", variant: "destructive" });
      return;
    }

    if (!serverForm.server_url.startsWith('http://') && !serverForm.server_url.startsWith('https://')) {
      toast({ title: "Error", description: "URL must start with http:// or https://", variant: "destructive" });
      return;
    }

    // Get header values from the HeaderEditor
    const headerValues = headersToServerForm(formHeaders);

    const serverData = {
      server_name: serverForm.server_name,
      server_url: serverForm.server_url,
      server_type: serverForm.server_type,
      display_order: serverForm.display_order,
      is_active: serverForm.is_active,
      referer_value: headerValues.referer_value || null,
      origin_value: headerValues.origin_value || null,
      cookie_value: headerValues.cookie_value || null,
      user_agent: headerValues.user_agent || null,
      ad_block_enabled: serverForm.ad_block_enabled,
      drm_license_url: null,
      drm_scheme: null,
      player_type: null,
      clearkey_key_id: null,
      clearkey_key: null,
      is_working: true,
      original_display_order: null,
    };

    // If editing an auto-synced server and the name has been changed by the user,
    // lock the name so future JSON syncs don't overwrite it.
    if (editingServer && (editingServer as any).auto_source_id) {
      if (serverForm.server_name !== editingServer.server_name) {
        (serverData as any).name_locked = true;
      }
    }

    try {
      if (editingServer) {
        await updateServer.mutateAsync({ id: editingServer.id, ...serverData });
        toast({ title: "Server updated successfully" });
      } else {
        await createServer.mutateAsync({ 
          match_id: match.id, 
          ...serverData 
        });
        toast({ title: "Server added successfully" });
      }
      setDialogOpen(false);
      resetForm();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleSaveSavedServer = async () => {
    if (!serverForm.server_name || !serverForm.server_url) {
      toast({ title: "Error", description: "Server name and URL are required", variant: "destructive" });
      return;
    }

    if (!serverForm.server_url.startsWith('http://') && !serverForm.server_url.startsWith('https://')) {
      toast({ title: "Error", description: "URL must start with http:// or https://", variant: "destructive" });
      return;
    }

    // Get header values from the HeaderEditor
    const headerValues = headersToServerForm(formHeaders);

    const savedData = {
      server_name: serverForm.server_name,
      server_url: serverForm.server_url,
      server_type: serverForm.server_type,
      referer_value: headerValues.referer_value || null,
      origin_value: headerValues.origin_value || null,
      cookie_value: headerValues.cookie_value || null,
      user_agent: headerValues.user_agent || null,
      ad_block_enabled: serverForm.ad_block_enabled,
      drm_license_url: null,
      drm_scheme: null,
      player_type: null,
      clearkey_key_id: null,
      clearkey_key: null,
      tags: editingSavedServer?.tags || [],
      notes: serverForm.notes || null,
    };

    try {
      if (editingSavedServer) {
        await updateSavedServer.mutateAsync({ id: editingSavedServer.id, ...savedData });
        toast({ title: "Saved server updated successfully" });
      } else {
        await createSavedServer.mutateAsync(savedData as any);
        toast({ title: "Server saved to library" });
      }
      setSavedDialogOpen(false);
      resetSavedForm();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteServer.mutateAsync(id);
      toast({ title: "Server deleted successfully" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    if (!servers) return;
    const sorted = [...servers].sort((a, b) => a.display_order - b.display_order);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;
    const a = sorted[index];
    const b = sorted[targetIndex];
    try {
      await Promise.all([
        updateServer.mutateAsync({ id: a.id, display_order: b.display_order }),
        updateServer.mutateAsync({ id: b.id, display_order: a.display_order }),
      ]);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleSaveToLibrary = async (server: StreamingServer) => {
    try {
      await createSavedServer.mutateAsync({
        server_name: server.server_name,
        server_url: server.server_url,
        server_type: server.server_type,
        referer_value: server.referer_value,
        origin_value: server.origin_value,
        cookie_value: server.cookie_value,
        user_agent: server.user_agent,
        ad_block_enabled: server.ad_block_enabled,
        drm_license_url: null,
        drm_scheme: null,
        player_type: null,
        clearkey_key_id: null,
        clearkey_key: null,
        tags: [],
        notes: null,
      });
      toast({ title: "Server saved to library" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleUseSavedServer = async (saved: SavedStreamingServer) => {
    try {
      const serverType = (saved.server_type === 'mpd' ? 'm3u8' : saved.server_type) as 'iframe' | 'm3u8' | 'embed';
      await createServer.mutateAsync({
        match_id: match.id,
        server_name: saved.server_name,
        server_url: saved.server_url,
        server_type: serverType,
        display_order: servers?.length || 0,
        is_active: true,
        referer_value: saved.referer_value,
        origin_value: saved.origin_value,
        cookie_value: saved.cookie_value,
        user_agent: saved.user_agent,
        ad_block_enabled: saved.ad_block_enabled || false,
        drm_license_url: null,
        drm_scheme: null,
        player_type: null,
        clearkey_key_id: null,
        clearkey_key: null,
        is_working: true,
        original_display_order: null,
      });
      toast({ title: "Server added to match" });
      setActiveTab('servers');
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteSavedServer = async (id: string) => {
    try {
      await deleteSavedServer.mutateAsync(id);
      toast({ title: "Server removed from library" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'm3u8': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'iframe': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'embed': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'iframe_to_m3u8': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const matchTitle = `${match.team_a?.name || 'Team A'} vs ${match.team_b?.name || 'Team B'}`;

  const renderServerForm = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Server Name *</Label>
        <Input
          placeholder="e.g., Server 1, HD Stream, Backup"
          value={serverForm.server_name}
          onChange={(e) => setServerForm({ ...serverForm, server_name: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <Label>Server Type *</Label>
        <Select 
          value={serverForm.server_type} 
          onValueChange={(v: 'iframe' | 'm3u8' | 'embed' | 'iframe_to_m3u8') => setServerForm({ ...serverForm, server_type: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="m3u8">M3U8 (HLS Stream)</SelectItem>
            <SelectItem value="iframe">iFrame Embed</SelectItem>
            <SelectItem value="embed">Custom Embed</SelectItem>
            <SelectItem value="iframe_to_m3u8">iFrame → M3U8 (Extract Stream)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Server URL *</Label>
        <Input
          placeholder={serverForm.server_type === 'm3u8' 
            ? 'https://example.com/stream.m3u8' 
            : serverForm.server_type === 'iframe_to_m3u8'
            ? 'https://example.com/embed/player (iframe URL to extract M3U8 from)'
            : 'https://example.com/embed/player'}
          value={serverForm.server_url}
          onChange={(e) => setServerForm({ ...serverForm, server_url: e.target.value })}
        />
        {serverForm.server_type === 'iframe_to_m3u8' && (
          <p className="text-xs text-muted-foreground">
            The M3U8 stream URL will be extracted from this iframe page automatically
          </p>
        )}
      </div>


      {/* Request Headers Section - Mod Header Style */}
      <div className="space-y-3 pt-4 border-t">
        <Label className="text-sm font-medium flex items-center gap-2">
          Request Headers
          <Badge variant="outline" className="text-xs font-normal">
            {serverForm.server_type === 'm3u8' || serverForm.server_type === 'iframe_to_m3u8' ? 'Proxied' : 'Optional'}
          </Badge>
        </Label>
        <HeaderEditor
          headers={formHeaders}
          onChange={setFormHeaders}
          compact
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Tv className="w-5 h-5 text-primary flex-shrink-0" />
            <span className="truncate">Streaming Servers</span>
          </h3>
          <p className="text-sm text-muted-foreground truncate">{matchTitle}</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'servers' | 'saved')} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="servers" className="text-xs sm:text-sm">
            <Tv className="w-4 h-4 mr-1 sm:mr-2 flex-shrink-0" />
            <span className="truncate">Match Servers</span>
          </TabsTrigger>
          <TabsTrigger value="saved" className="text-xs sm:text-sm">
            <Library className="w-4 h-4 mr-1 sm:mr-2 flex-shrink-0" />
            <span className="truncate">Saved Library</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="servers" className="space-y-4 mt-4">
          <div className="flex justify-end">
            <Button variant="gradient" size="sm" onClick={() => setDialogOpen(true)} className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-1" />
              Add Server
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : servers?.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <Tv className="w-12 h-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No streaming servers configured</p>
                <p className="text-sm text-muted-foreground/70">Add M3U8 or iframe links for this match</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {[...(servers || [])].sort((a, b) => a.display_order - b.display_order).map((server, idx, arr) => (
                <Card key={server.id} className={`${!server.is_active ? 'opacity-60' : ''}`}>
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex flex-col gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <Play className="w-4 h-4 text-primary flex-shrink-0" />
                          <span className="font-medium truncate">{server.server_name}</span>
                          <Badge variant="outline" className={`${getTypeColor(server.server_type)} text-xs`}>
                            {server.server_type.toUpperCase()}
                          </Badge>
                          {!server.is_active && (
                            <Badge variant="secondary" className="text-xs">Inactive</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{server.server_url}</p>
                        <p className="text-xs text-muted-foreground">Order: {server.display_order}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex items-center gap-1 mr-auto">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleMove(idx, 'up')}
                            disabled={idx === 0 || updateServer.isPending}
                            title="Move up"
                            className="h-8 w-8"
                          >
                            <ArrowUp className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleMove(idx, 'down')}
                            disabled={idx === arr.length - 1 || updateServer.isPending}
                            title="Move down"
                            className="h-8 w-8"
                          >
                            <ArrowDown className="w-4 h-4" />
                          </Button>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSaveToLibrary(server)}
                          className="flex-1 sm:flex-none"
                          disabled={createSavedServer.isPending}
                        >
                          <BookmarkPlus className="w-4 h-4 mr-1" />
                          <span className="hidden sm:inline">Save</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => window.open(server.server_url, '_blank')}
                          title="Preview URL"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(server)}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(server.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="saved" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search saved servers..."
                value={savedSearchQuery}
                onChange={(e) => setSavedSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button 
              variant="gradient" 
              size="sm" 
              onClick={() => {
                resetSavedForm();
                setSavedDialogOpen(true);
              }}
              className="w-full sm:w-auto"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add New
            </Button>
          </div>

          {savedLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : savedServers?.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <Library className="w-12 h-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No saved servers</p>
                <p className="text-sm text-muted-foreground/70">
                  Click "Add New" to create a reusable server template
                </p>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[300px]">
              <div className="space-y-3 pr-4">
                {savedServers?.map((saved) => (
                  <Card key={saved.id} className="overflow-hidden">
                    <CardContent className="p-3">
                      <div className="flex flex-col gap-2">
                        {/* Header row: Name + Type badge */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                              <span className="font-medium text-sm truncate">{saved.server_name}</span>
                              <Badge variant="outline" className={`${getTypeColor(saved.server_type)} text-[10px] px-1.5 py-0`}>
                                {saved.server_type.toUpperCase()}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{saved.server_url}</p>
                          </div>
                        </div>
                        
                        {/* Notes section - displayed if present */}
                        {saved.notes && (
                          <div className="flex items-start gap-1.5 bg-muted/50 rounded-md px-2 py-1.5">
                            <FileText className="w-3 h-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-muted-foreground line-clamp-2">{saved.notes}</p>
                          </div>
                        )}
                        
                        {/* Action buttons - compact horizontal layout */}
                        <div className="flex items-center gap-1.5 pt-1">
                          <Button
                            variant="gradient"
                            size="sm"
                            onClick={() => handleUseSavedServer(saved)}
                            className="flex-1 h-8 text-xs"
                            disabled={createServer.isPending}
                          >
                            <Copy className="w-3 h-3 mr-1" />
                            Use
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => window.open(saved.server_url, '_blank')}
                            title="Preview URL"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleEditSaved(saved)}
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteSavedServer(saved.id)}
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>

      {/* Add/Edit Match Server Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingServer ? 'Edit Server' : 'Add Streaming Server'}</DialogTitle>
            <DialogDescription>
              Add an M3U8 stream URL or iframe embed link
            </DialogDescription>
          </DialogHeader>
          
          {renderServerForm()}
          
          {/* Match server specific fields */}
          <div className="space-y-4 pt-4 border-t">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Display Order</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={serverForm.display_order}
                  onChange={(e) => setServerForm({ ...serverForm, display_order: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Switch
                  checked={serverForm.is_active}
                  onCheckedChange={(checked) => setServerForm({ ...serverForm, is_active: checked })}
                />
                <Label className="text-sm">Active</Label>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => {
              setDialogOpen(false);
              resetForm();
            }} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button 
              variant="gradient" 
              onClick={handleSave}
              disabled={createServer.isPending || updateServer.isPending}
              className="w-full sm:w-auto"
            >
              {(createServer.isPending || updateServer.isPending) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {editingServer ? 'Update' : 'Add Server'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Saved Server Dialog */}
      <Dialog open={savedDialogOpen} onOpenChange={(open) => {
        setSavedDialogOpen(open);
        if (!open) resetSavedForm();
      }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSavedServer ? 'Edit Saved Server' : 'Add to Library'}</DialogTitle>
            <DialogDescription>
              {editingSavedServer 
                ? 'Update this saved server template' 
                : 'Create a reusable server template'}
            </DialogDescription>
          </DialogHeader>
          
          {renderServerForm()}

          {/* Notes field for saved servers */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Notes
            </Label>
            <Input
              placeholder="e.g., IPL 2025, BPL, PSL, Star Sports HD..."
              value={serverForm.notes}
              onChange={(e) => setServerForm({ ...serverForm, notes: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Add a note to remember which tournament or channel this server is for
            </p>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => {
              setSavedDialogOpen(false);
              resetSavedForm();
            }} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button 
              variant="gradient" 
              onClick={handleSaveSavedServer}
              disabled={createSavedServer.isPending || updateSavedServer.isPending}
              className="w-full sm:w-auto"
            >
              {(createSavedServer.isPending || updateSavedServer.isPending) && (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              )}
              {editingSavedServer ? 'Update' : 'Save to Library'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StreamingServersManager;
