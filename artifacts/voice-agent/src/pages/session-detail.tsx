import { useGetVoiceSession, useGetVoiceSessionMessages } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, ArrowLeft, User, Bot, Clock, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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
      <div className="p-8 max-w-4xl mx-auto space-y-6">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Session Not Found</CardTitle>
            <CardDescription>The requested operation log could not be located.</CardDescription>
          </CardHeader>
        </Card>
        <Button asChild variant="outline">
          <Link href="/sessions">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Sessions
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6 flex flex-col h-full">
      <div className="flex items-center gap-4">
        <Button asChild variant="ghost" size="icon" className="h-8 w-8">
          <Link href="/sessions">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Operation: {session.roomName}</h1>
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {format(new Date(session.startedAt), "MMM d, yyyy HH:mm")}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {session.durationSeconds ? `${session.durationSeconds}s` : "Ongoing"}
            </span>
            <span className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              {session.participantName}
            </span>
          </div>
        </div>
      </div>

      <Card className="flex-1 flex flex-col min-h-0 overflow-hidden border-primary/10 shadow-sm">
        <CardHeader className="border-b bg-muted/30 py-4">
          <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground flex items-center justify-between">
            <span>Transcript Log</span>
            <span>{messagesData?.messages.length || 0} Entries</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-6 space-y-6">
          {!messagesData?.messages || messagesData.messages.length === 0 ? (
            <div className="text-center text-muted-foreground p-8 flex flex-col items-center">
              <Bot className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p>No transcript data available for this operation.</p>
            </div>
          ) : (
            messagesData.messages.map((message) => {
              const isAssistant = message.role === "assistant";
              return (
                <div 
                  key={message.id} 
                  className={cn(
                    "flex gap-4 max-w-[85%]",
                    isAssistant ? "mr-auto" : "ml-auto flex-row-reverse"
                  )}
                >
                  <div className={cn(
                    "flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center border",
                    isAssistant 
                      ? "bg-primary/10 border-primary/20 text-primary" 
                      : "bg-muted border-border text-muted-foreground"
                  )}>
                    {isAssistant ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                  </div>
                  
                  <div className={cn(
                    "rounded-xl px-4 py-3 text-sm leading-relaxed",
                    isAssistant 
                      ? "bg-muted border border-border/50 text-foreground rounded-tl-none" 
                      : "bg-primary text-primary-foreground shadow-sm rounded-tr-none"
                  )}>
                    <p className="whitespace-pre-wrap">{message.content}</p>
                    <div className={cn(
                      "text-[10px] mt-2 text-right opacity-60 font-mono",
                      isAssistant ? "text-muted-foreground" : "text-primary-foreground"
                    )}>
                      {format(new Date(message.createdAt), "HH:mm:ss")}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
