import { useState, useEffect } from "react";
import { useCreateVoiceToken } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Mic, PhoneOff, Radio } from "lucide-react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  BarVisualizer,
  useVoiceAssistant,
  useConnectionState,
} from "@livekit/components-react";
import { ConnectionState } from "livekit-client";

export function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [roomName, setRoomName] = useState("");
  const [participantName, setParticipantName] = useState("");
  
  const createToken = useCreateVoiceToken();

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName || !participantName) return;

    createToken.mutate(
      { data: { roomName, participantName } },
      {
        onSuccess: (data) => {
          setToken(data.token);
          setServerUrl(data.serverUrl);
        },
      }
    );
  };

  const handleLeave = () => {
    setToken(null);
    setServerUrl(null);
  };

  return (
    <div className="h-full p-8 max-w-4xl mx-auto flex flex-col items-center justify-center">
      <div className="w-full mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Command Center</h1>
        <p className="text-muted-foreground mt-2">Initialize and monitor real-time AI voice operations.</p>
      </div>

      {!token || !serverUrl ? (
        <Card className="w-full max-w-md shadow-xl border-primary/20">
          <CardHeader>
            <CardTitle>Initialize Session</CardTitle>
            <CardDescription>Enter operation parameters to connect to the voice matrix.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleJoin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="roomName">Operation ID (Room)</Label>
                <Input
                  id="roomName"
                  placeholder="e.g. op-alpha-7"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  disabled={createToken.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="participantName">Operator Name</Label>
                <Input
                  id="participantName"
                  placeholder="e.g. Cmdr. Shepard"
                  value={participantName}
                  onChange={(e) => setParticipantName(e.target.value)}
                  disabled={createToken.isPending}
                />
              </div>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={createToken.isPending || !roomName || !participantName}
              >
                {createToken.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Radio className="mr-2 h-4 w-4" />
                )}
                Establish Connection
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <LiveKitRoom
          token={token}
          serverUrl={serverUrl}
          connect={true}
          audio={true}
          video={false}
          onDisconnected={handleLeave}
          className="w-full max-w-2xl"
        >
          <RoomAudioRenderer />
          <ActiveCallUI roomName={roomName} onLeave={handleLeave} />
        </LiveKitRoom>
      )}
    </div>
  );
}

function ActiveCallUI({ roomName, onLeave }: { roomName: string, onLeave: () => void }) {
  const connectionState = useConnectionState();
  const { state: agentState, audioTrack } = useVoiceAssistant();

  const isConnected = connectionState === ConnectionState.Connected;
  
  return (
    <Card className="w-full shadow-2xl border-primary/40 bg-card/95 backdrop-blur">
      <CardHeader className="pb-4 border-b border-border">
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center gap-2">
              <div className={cn(
                "h-3 w-3 rounded-full",
                isConnected ? "bg-green-500 animate-pulse" : "bg-yellow-500 animate-pulse"
              )} />
              Operation: {roomName}
            </CardTitle>
            <CardDescription className="mt-1">
              Status: <span className="font-mono uppercase text-xs">{connectionState}</span>
            </CardDescription>
          </div>
          <Button variant="destructive" size="sm" onClick={onLeave}>
            <PhoneOff className="mr-2 h-4 w-4" />
            Terminate
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-8 pb-10 flex flex-col items-center justify-center min-h-[300px]">
        
        {isConnected ? (
          <div className="flex flex-col items-center w-full max-w-md">
            <div className="mb-8 relative flex items-center justify-center h-32 w-full">
              <div className={cn(
                "absolute inset-0 rounded-full blur-3xl opacity-20 transition-all duration-700",
                agentState === "speaking" ? "bg-primary opacity-40 scale-110" : "bg-muted"
              )} />
              
              {audioTrack ? (
                <div className="h-24 w-full px-8 relative z-10">
                  <BarVisualizer 
                    state={agentState} 
                    trackRef={audioTrack} 
                    barCount={7} 
                    options={{ minHeight: 10 }}
                    className="w-full h-full flex items-center justify-center gap-1 [&>div]:bg-primary [&>div]:rounded-full [&>div]:w-4 [&>div]:transition-all"
                  />
                </div>
              ) : (
                <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center border border-primary/30 z-10">
                  <Mic className="h-8 w-8 text-primary/50" />
                </div>
              )}
            </div>
            
            <div className="text-center space-y-2">
              <h3 className="text-xl font-medium">Nexus AI Agent</h3>
              <p className="text-sm font-mono text-muted-foreground uppercase tracking-widest">
                {agentState === "speaking" ? "Transmitting..." : 
                 agentState === "listening" ? "Receiving..." : 
                 "Standby"}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mb-4" />
            <p>Negotiating handshake...</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function cn(...classes: (string | undefined | null | false)[]) {
  return classes.filter(Boolean).join(" ");
}
