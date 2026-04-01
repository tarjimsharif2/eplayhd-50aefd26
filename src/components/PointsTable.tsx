import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Team } from '@/hooks/useSportsData';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export interface PointsTableEntry {
  id: string;
  tournament_id: string;
  team_id: string;
  position: number;
  played: number;
  won: number;
  lost: number;
  tied: number;
  no_result: number;
  net_run_rate: number;
  points: number;
  group_name?: string | null;
  team?: Team;
}

export const usePointsTable = (tournamentId: string | undefined) => {
  return useQuery({
    queryKey: ['points_table', tournamentId],
    queryFn: async () => {
      if (!tournamentId) return [];
      
      const { data, error } = await supabase
        .from('tournament_points_table')
        .select(`
          *,
          team:teams(*)
        `)
        .eq('tournament_id', tournamentId)
        .order('group_name', { ascending: true, nullsFirst: true })
        .order('position', { ascending: true });
      
      if (error) throw error;
      return data as PointsTableEntry[];
    },
    enabled: !!tournamentId,
  });
};

interface PointsTableProps {
  tournamentId: string;
  tournamentName?: string;
  compact?: boolean;
  syncTime?: string | null;
  dailySyncEnabled?: boolean;
  onCompleteSyncEnabled?: boolean;
}

interface GroupedEntries {
  [groupName: string]: PointsTableEntry[];
}

const PointsTable = ({ tournamentId, tournamentName, compact = false, syncTime, dailySyncEnabled = false, onCompleteSyncEnabled = false }: PointsTableProps) => {
  const { data: entries, isLoading } = usePointsTable(tournamentId);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  if (isLoading) {
    return null;
  }

  if (!entries || entries.length === 0) {
    return null;
  }

  // Count unique teams
  const uniqueTeamCount = new Set(entries.map(e => e.team_id)).size;

  // Group entries by group_name
  const groupedEntries: GroupedEntries = entries.reduce((acc, entry) => {
    const groupName = entry.group_name || 'All Teams';
    if (!acc[groupName]) {
      acc[groupName] = [];
    }
    acc[groupName].push(entry);
    return acc;
  }, {} as GroupedEntries);

  // Sort groups: active (lower max played) first, completed (higher max played) last
  const groupNames = Object.keys(groupedEntries).sort((a, b) => {
    if (a === 'All Teams') return -1;
    if (b === 'All Teams') return 1;
    const maxPlayedA = Math.max(...groupedEntries[a].map(e => e.played || 0));
    const maxPlayedB = Math.max(...groupedEntries[b].map(e => e.played || 0));
    if (maxPlayedA !== maxPlayedB) return maxPlayedA - maxPlayedB; // Lower played = active = first
    return a.localeCompare(b);
  });

  const hasGroups = groupNames.length > 1 || (groupNames.length === 1 && groupNames[0] !== 'All Teams');

  const toggleRow = (rowId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(rowId)) {
        newSet.delete(rowId);
      } else {
        newSet.add(rowId);
      }
      return newSet;
    });
  };

  const formatNRR = (nrr: unknown) => {
    const num = Number(nrr);
    if (!Number.isFinite(num)) return '+0.000';
    const formatted = num.toFixed(3);
    return num >= 0 ? `+${formatted}` : formatted;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <Card className="overflow-hidden border-border/50 bg-card/95 backdrop-blur shadow-xl">
        <CardHeader className="pb-3 px-4 bg-gradient-to-r from-primary/10 via-transparent to-accent/10 border-b border-border/30">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <Trophy className="w-4 h-4 text-primary" />
              </div>
              <span className="truncate">
                {tournamentName ? `${tournamentName} - Points Table` : 'Points Table'}
              </span>
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              {uniqueTeamCount} Teams
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {groupNames.map((groupName, groupIndex) => {
            const groupEntries = groupedEntries[groupName];
            
            return (
              <div key={groupName}>
                {/* Group Header */}
                <div className="bg-muted/60 dark:bg-muted/40 px-4 py-2.5 border-b border-border/30 sticky top-0 z-10">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {hasGroups ? groupName : 'Teams'}
                    </span>
                    <div className="flex items-center gap-3 text-[10px] sm:text-xs font-medium text-muted-foreground">
                      <span className="w-6 text-center">P</span>
                      <span className="w-6 text-center">W</span>
                      <span className="w-6 text-center">L</span>
                      <span className="w-6 text-center">NR</span>
                      <span className="w-8 text-center">PTS</span>
                      <span className="w-14 text-center">NRR</span>
                      <span className="w-5"></span>
                    </div>
                  </div>
                </div>

                {/* Team Rows */}
                {groupEntries.map((entry, index) => {
                  const position = entry.position || index + 1;
                  const isExpanded = expandedRows.has(entry.id);
                  
                  return (
                    <div key={entry.id} className="border-b border-border/20 last:border-b-0">
                      {/* Main Row */}
                      <div 
                        className={cn(
                          "flex items-center justify-between px-4 py-3 cursor-pointer transition-colors hover:bg-muted/30",
                          isExpanded && "bg-muted/20"
                        )}
                        onClick={() => toggleRow(entry.id)}
                      >
                        <div className="flex items-center gap-3">
                          {/* Position */}
                          <span className="w-5 text-sm font-medium text-muted-foreground">
                            {position}
                          </span>
                          
                          {/* Team Logo */}
                          {entry.team?.logo_url ? (
                            <img 
                              src={entry.team.logo_url} 
                              alt={entry.team.name} 
                              className="w-6 h-6 sm:w-7 sm:h-7 object-contain"
                            />
                          ) : (
                            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                              <span className="text-[10px] font-bold text-primary">
                                {entry.team?.short_name?.charAt(0)}
                              </span>
                            </div>
                          )}
                          
                          {/* Team Name */}
                          <span className="font-semibold text-sm text-primary">
                            {entry.team?.short_name || entry.team?.name}
                          </span>
                        </div>

                        {/* Stats */}
                        <div className="flex items-center gap-3 text-xs sm:text-sm">
                          <span className="w-6 text-center font-medium">{entry.played}</span>
                          <span className="w-6 text-center font-medium">{entry.won}</span>
                          <span className="w-6 text-center font-medium">{entry.lost}</span>
                          <span className="w-6 text-center font-medium">{entry.no_result}</span>
                          <span className="w-8 text-center font-semibold">{entry.points}</span>
                          <span className={cn(
                            "w-14 text-center font-medium",
                            entry.net_run_rate >= 0 ? "text-green-500" : "text-red-500"
                          )}>
                            {formatNRR(entry.net_run_rate)}
                          </span>
                          <div className="w-5 flex justify-center">
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 py-3 bg-muted/20 border-t border-border/20">
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <div className="text-center">
                                  <div className="text-lg font-bold">{entry.played}</div>
                                  <div className="text-xs text-muted-foreground">Matches Played</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-lg font-bold text-green-500">{entry.won}</div>
                                  <div className="text-xs text-muted-foreground">Won</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-lg font-bold text-red-500">{entry.lost}</div>
                                  <div className="text-xs text-muted-foreground">Lost</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-lg font-bold">{entry.tied}</div>
                                  <div className="text-xs text-muted-foreground">Tied</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-lg font-bold">{entry.no_result}</div>
                                  <div className="text-xs text-muted-foreground">No Result</div>
                                </div>
                                <div className="text-center">
                                  <div className="text-lg font-bold text-primary">{entry.points}</div>
                                  <div className="text-xs text-muted-foreground">Points</div>
                                </div>
                                <div className="text-center col-span-2">
                                  <div className={cn(
                                    "text-lg font-bold",
                                    entry.net_run_rate >= 0 ? "text-green-500" : "text-red-500"
                                  )}>
                                    {formatNRR(entry.net_run_rate)}
                                  </div>
                                  <div className="text-xs text-muted-foreground">Net Run Rate</div>
                                </div>
                              </div>
                              {entry.team?.name !== entry.team?.short_name && (
                                <div className="mt-3 pt-3 border-t border-border/20 text-center">
                                  <span className="text-sm text-muted-foreground">
                                    {entry.team?.name}
                                  </span>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            );
          })}
          {/* Show sync info based on enabled modes */}
          {(dailySyncEnabled || onCompleteSyncEnabled) && (() => {
            if (dailySyncEnabled && syncTime) {
              // Support multiple comma-separated sync times
              const syncTimes = syncTime.split(',').map(t => t.trim()).filter(Boolean);
              const localTimes = syncTimes.map(singleTime => {
                const parts = singleTime.match(/^(\d{2}):(\d{2})([+-]\d{2}:\d{2})?$/);
                if (!parts) return singleTime.split(/[+-]/)?.[0] || singleTime;
                
                const [, hh, mm, offset] = parts;
                const today = new Date();
                const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                const isoStr = offset 
                  ? `${dateStr}T${hh}:${mm}:00${offset}` 
                  : `${dateStr}T${hh}:${mm}:00Z`;
                const syncDate = new Date(isoStr);
                
                if (isNaN(syncDate.getTime())) return singleTime.split(/[+-]/)?.[0] || singleTime;
                
                return syncDate.toLocaleTimeString('en-US', { 
                  hour: 'numeric', 
                  minute: '2-digit', 
                  hour12: true 
                });
              });
              
              const tzAbbr = new Date().toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop() || '';
              const timeDisplay = localTimes.join(', ') + (tzAbbr ? ` (${tzAbbr})` : '');
              
              return (
                <div className="px-4 py-2 border-t border-border/20 flex items-center justify-center gap-1.5">
                  <Clock className="w-3 h-3 text-muted-foreground/60" />
                  <span className="text-[10px] text-muted-foreground/60">
                    Auto-syncs daily at {timeDisplay}
                    {onCompleteSyncEnabled ? ' & on match complete' : ''}
                  </span>
                </div>
              );
            }
            
            if (onCompleteSyncEnabled) {
              return (
                <div className="px-4 py-2 border-t border-border/20 flex items-center justify-center gap-1.5">
                  <Clock className="w-3 h-3 text-muted-foreground/60" />
                  <span className="text-[10px] text-muted-foreground/60">
                    Auto-syncs on match complete
                  </span>
                </div>
              );
            }
            
            return null;
          })()}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default PointsTable;