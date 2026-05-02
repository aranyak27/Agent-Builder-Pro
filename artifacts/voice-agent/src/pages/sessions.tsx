import { useListVoiceSessions } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar, Clock, MessageSquare, ArrowRight, FileText } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";

const OUTCOME_LABELS: Record<string, { label: string; color: string }> = {
  promise_to_pay:     { label: "Promise to Pay",    color: "bg-emerald-500/15 text-emerald-700 border-emerald-300" },
  already_paid:       { label: "Already Paid",       color: "bg-blue-500/15 text-blue-700 border-blue-300" },
  callback_request:   { label: "Callback Requested", color: "bg-amber-500/15 text-amber-700 border-amber-300" },
  dispute:            { label: "Dispute",             color: "bg-red-500/15 text-red-700 border-red-300" },
  transfer_to_human:  { label: "Transferred",        color: "bg-purple-500/15 text-purple-700 border-purple-300" },
};

function OutcomeBadge({ type }: { type: string | null | undefined }) {
  if (!type) return <Badge variant="outline" className="text-muted-foreground border-border">No Outcome</Badge>;
  const meta = OUTCOME_LABELS[type];
  if (!meta) return <Badge variant="outline">{type}</Badge>;
  return (
    <span className={`inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold ${meta.color}`}>
      {meta.label}
    </span>
  );
}

export function Sessions() {
  const { data, isLoading, error } = useListVoiceSessions({ limit: 50 });

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Session Log</h1>
        <p className="text-muted-foreground mt-2">All voice sessions with transcripts and call outcomes.</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <Card className="border-destructive">
          <CardContent className="p-6">
            <p className="text-destructive font-medium">Error loading sessions</p>
            <p className="text-sm text-muted-foreground mt-1">Could not retrieve the session log.</p>
          </CardContent>
        </Card>
      ) : !data?.sessions.length ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="font-medium text-muted-foreground">No sessions yet</p>
            <p className="text-sm text-muted-foreground mt-1">Sessions will appear here after the first call.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {data.sessions.map((session) => (
            <Link key={session.id} href={`/sessions/${session.id}`} className="block">
              <Card className="hover:border-primary/40 hover:shadow-md transition-all duration-200 cursor-pointer">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between gap-4">
                    {/* Left: room + meta */}
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                        <span className="font-semibold text-base truncate">{session.roomName}</span>
                        <OutcomeBadge type={session.outcomeType} />
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground pl-4">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(session.startedAt), "dd MMM yyyy, HH:mm")}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {session.durationSeconds ? `${session.durationSeconds}s` : "—"}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          {session.messageCount} messages
                        </span>
                      </div>
                    </div>

                    {/* Right: participant + arrow */}
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right hidden sm:block">
                        <p className="text-sm font-medium">{session.participantName}</p>
                        <p className="text-xs text-muted-foreground">Customer</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>

                  {/* Outcome detail row */}
                  {session.outcomeData && Object.keys(session.outcomeData).length > 0 && (
                    <div className="mt-3 pl-4 flex flex-wrap gap-3 border-t pt-3">
                      {Object.entries(session.outcomeData).map(([k, v]) => (
                        <span key={k} className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground capitalize">{k.replace(/_/g, " ")}:</span>{" "}
                          {String(v)}
                        </span>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
