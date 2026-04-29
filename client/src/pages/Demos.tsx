import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, PlayCircle } from "lucide-react";

/**
 * Lightweight demos page — videos are static assets in
 * client/public/demos/. Add a new entry here whenever a new clip
 * lands in that folder; src is relative to the site root.
 */
type Demo = {
  id: string;
  title: string;
  description: string;
  src: string;
  // Optional poster lives in /demos too if you want a thumbnail; the
  // browser falls back to the first frame when this is undefined.
  poster?: string;
  durationLabel?: string;
};

const DEMOS: Demo[] = [
  {
    id: "workspace-walkthrough",
    title: "Workspace walkthrough",
    description:
      "A tour of the auditor workspace — bulk upload, full-screen review, sidebar findings, add / delete custom downgrades, and the round-trip back to the bulk queue.",
    src: "/demos/workspace-walkthrough.mp4",
  },
];

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function DemoCard({ demo }: { demo: Demo }) {
  return (
    <Card className="overflow-hidden shadow-sm">
      <div className="bg-black aspect-video">
        <video
          controls
          preload="metadata"
          poster={demo.poster}
          className="w-full h-full"
          data-testid={`video-${demo.id}`}
        >
          <source src={demo.src} type="video/mp4" />
          Your browser doesn't support inline video; use the Download button below.
        </video>
      </div>

      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold flex items-center gap-2">
            <PlayCircle className="w-4 h-4 text-primary" />
            {demo.title}
          </p>
          <p className="text-sm text-muted-foreground mt-1">{demo.description}</p>
          {demo.durationLabel && (
            <p className="text-xs text-muted-foreground mt-1">{demo.durationLabel}</p>
          )}
        </div>
        <a
          href={demo.src}
          download
          className="shrink-0"
          data-testid={`link-download-${demo.id}`}
        >
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
        </a>
      </div>
    </Card>
  );
}

export default function Demos() {
  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold font-heading tracking-tight">Demos</h1>
          <p className="text-muted-foreground">
            Recorded walkthroughs of the auditor flow. Each clip plays inline; use Download to grab a copy you can scrub through offline or share.
          </p>
        </div>

        <div className="space-y-4">
          {DEMOS.map((demo) => (
            <DemoCard key={demo.id} demo={demo} />
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
