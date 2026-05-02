import { useGetVoiceSession, useGetVoiceSessionMessages } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, ArrowLeft, User, Bot, Clock, Calendar, CheckCircle2, PhoneCall, AlertCircle, PhoneForwarded, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const OUTCOME_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string; bg: string }> = {
  promise_to_pay:    { label: "Promise to Pay",    icon: CheckCircle2,    color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
  already_paid:      { label: "Already Paid",       icon: CreditCard,      color: "text-blue-700",    bg: "bg-blue-50 border-blue-200" },
  callback_request:  { label: "Callback Requested", icon: PhoneCall,       color: "text-amber-700",   bg: "bg-amber-50 border-amber-200" },
  dispute:           { label: "Dispute",             icon: AlertCircle,     color: "text-red-700",     bg: "bg-red-50 border-red-200" },
  transfer_to_human: { label: "Transferred to Human", icon: PhoneForwarded, color: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
};

const FIELD_LABELS: Record<string, string> = {
  amount:        "Amount",
  payment_date:  "Payment Date",
  payment_mode:  "Payment Mode",
  callback_time: "Callback Time",
  reason:        "Reason",
};

export function SessionDetail() {
  const params = useParams();
  const id = params.id ? parseInt(params.id) : 0;

  const { data: session, isLoading: sessionLoading } = useGetVoiceSession(id);
  const { data: messagesData, isLoading: messagesLoading } = useGetVoiceSessionMessages(id);

  if (sessionLoading || messagesLoading) {
    return (
      <div className="flex items-center justify-center p-12 h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="p-8 max-w-4xl mx-auto space-y-4">
        <Card className="border-destructive">
          <CardContent className="p-6">
            <p className="font-medium text-destructive">Session not found</p>
          </CardContent>
        </Card>
        <Button asChild variant="outline">
          <Link href="/sessions"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link>
        </Button>
      </div>
    );
  }

  const outcomeKey = (session as any).outcomeType as string | null | undefined;
  const outcomeData = (session as any).outcomeData as Record<string, string> | null | undefined;
  const outcomeMeta = outcomeKey ? OUTCOME_META[outcomeKey] : null;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
          <Link href="/sessions"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight truncate">Room: {session.roomName}</h1>
          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(new Date(session.startedAt), "dd MMM yyyy, HH:mm")}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {session.durationSeconds ? `${session.durationSeconds}s` : "Ongoing"}
            </span>
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {session.participantName}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="transcript" className="flex-1 flex flex-col min-h-0">
        <TabsList className="w-fit">
          <TabsTrigger value="transcript">Transcript</TabsTrigger>
          <TabsTrigger value="outcome">Outcome / Intent</TabsTrigger>
        </TabsList>

        {/* ── Transcript Tab ─────────────────────────────────────────── */}
        <TabsContent value="transcript" className="flex-1 mt-4 min-h-0">
          <Card className="flex flex-col h-full min-h-[400px] border-border/60">
            <CardHeader className="border-b bg-muted/30 py-3 px-5">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex justify-between">
                <span>Full Transcript</span>
                <span>{messagesData?.messages.length ?? 0} turns</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-5 space-y-5">
              {!messagesData?.messages?.length ? (
                <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                  <Bot className="h-10 w-10 mb-3 opacity-20" />
                  <p className="text-sm">No transcript available for this session.</p>
                  <p className="text-xs mt-1 opacity-70">Transcript logging requires LiveKit webhook events to be configured.</p>
                </div>
              ) : (
                messagesData.messages.map((msg) => {
                  const isAgent = msg.role === "assistant";
                  return (
                    <div
                      key={msg.id}
                      className={cn("flex gap-3 max-w-[88%]", isAgent ? "mr-auto" : "ml-auto flex-row-reverse")}
                    >
                      <div className={cn(
                        "flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center border text-xs",
                        isAgent
                          ? "bg-primary/10 border-primary/20 text-primary"
                          : "bg-muted border-border text-muted-foreground"
                      )}>
                        {isAgent ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                      </div>
                      <div className={cn(
                        "rounded-xl px-4 py-2.5 text-sm leading-relaxed",
                        isAgent
                          ? "bg-muted border border-border/50 text-foreground rounded-tl-none"
                          : "bg-primary text-primary-foreground shadow-sm rounded-tr-none"
                      )}>
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                        <p className={cn(
                          "text-[10px] mt-1.5 text-right font-mono opacity-50",
                          isAgent ? "text-muted-foreground" : "text-primary-foreground"
                        )}>
                          {format(new Date(msg.createdAt), "HH:mm:ss")}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Outcome Tab ────────────────────────────────────────────── */}
        <TabsContent value="outcome" className="mt-4 space-y-4">
          {!outcomeKey ? (
            <Card className="border-dashed">
              <CardContent className="p-10 text-center">
                <AlertCircle className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                <p className="font-medium text-muted-foreground">No outcome recorded</p>
                <p className="text-sm text-muted-foreground mt-1">
                  The agent did not capture a structured outcome for this session.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Outcome type card */}
              <Card className={cn("border", outcomeMeta?.bg ?? "bg-muted")}>
                <CardContent className="p-5 flex items-center gap-4">
                  {outcomeMeta && (
                    <div className={cn("h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0", outcomeMeta.bg)}>
                      <outcomeMeta.icon className={cn("h-5 w-5", outcomeMeta.color)} />
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Call Outcome</p>
                    <p className={cn("text-lg font-bold mt-0.5", outcomeMeta?.color ?? "text-foreground")}>
                      {outcomeMeta?.label ?? outcomeKey.replace(/_/g, " ")}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Outcome data fields */}
              {outcomeData && Object.keys(outcomeData).length > 0 && (
                <Card>
                  <CardHeader className="pb-3 border-b">
                    <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                      Details
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 divide-y divide-border">
                    {Object.entries(outcomeData).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between px-5 py-3.5">
                        <span className="text-sm text-muted-foreground">
                          {FIELD_LABELS[key] ?? key.replace(/_/g, " ")}
                        </span>
                        <span className="text-sm font-semibold text-foreground">{String(value)}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* CRM info box */}
              <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
                This outcome was automatically captured by the agent at the end of the call and posted to the configured CRM webhook.
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
