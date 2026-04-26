import { useListVoiceSessions } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Calendar, Clock, MessageSquare, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { format } from "date-fns";

export function Sessions() {
  const { data, isLoading, error } = useListVoiceSessions({ limit: 50 });

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Session History</h1>
        <p className="text-muted-foreground mt-2">Past AI voice operations and metadata.</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : error ? (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error Loading Sessions</CardTitle>
            <CardDescription>Could not retrieve the operation log.</CardDescription>
          </CardHeader>
        </Card>
      ) : data?.sessions.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No Sessions Found</CardTitle>
            <CardDescription>No voice operations have been logged yet.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4">
          {data?.sessions.map((session) => (
            <Card key={session.id} className="hover-elevate transition-all duration-200">
              <Link href={`/sessions/${session.id}`} className="block h-full">
                <CardContent className="p-6 flex items-center justify-between">
                  <div className="space-y-1">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-primary" />
                      {session.roomName}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {format(new Date(session.startedAt), "MMM d, yyyy HH:mm")}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        {session.durationSeconds ? `${session.durationSeconds}s` : "Ongoing"}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="h-3.5 w-3.5" />
                        {session.messageCount} msgs
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-medium">{session.participantName}</p>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Operator</p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
