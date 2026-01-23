import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  UploadCloud, 
  FileText, 
  CheckCircle2, 
  Loader2, 
  X,
  File
} from "lucide-react";
import { useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";

export default function Upload() {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const handleFiles = (newFiles: File[]) => {
    setFiles([...files, ...newFiles]);
    simulateUpload();
  };

  const simulateUpload = () => {
    setIsUploading(true);
    setUploadProgress(0);
    
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsUploading(false);
          toast({
            title: "Processing Complete",
            description: "Your statements have been parsed and audited.",
          });
          return 100;
        }
        return prev + 10;
      });
    }, 300);
  };

  const removeFile = (index: number) => {
    const newFiles = [...files];
    newFiles.splice(index, 1);
    setFiles(newFiles);
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-4xl mx-auto">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold font-heading tracking-tight">Upload Statements</h1>
          <p className="text-muted-foreground">
            Upload your monthly processing statements (PDF or CSV). We support all major processors including Stripe, Square, and Chase.
          </p>
        </div>

        {/* Upload Zone */}
        <div 
          className={`
            border-2 border-dashed rounded-xl p-12 text-center transition-all duration-300 ease-in-out cursor-pointer group
            ${isDragging ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-border bg-card hover:bg-secondary/30 hover:border-primary/50'}
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            multiple 
            accept=".pdf,.csv" 
            onChange={handleFileSelect}
          />
          
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-primary/20 transition-colors">
            <UploadCloud className="w-8 h-8 text-primary" />
          </div>
          
          <h3 className="text-xl font-semibold mb-2">Click to upload or drag and drop</h3>
          <p className="text-muted-foreground max-w-sm mx-auto mb-6">
            PDF or CSV files allowed. Max file size 10MB.
          </p>
          
          <Button variant="outline" className="min-w-[140px]">Select Files</Button>
        </div>

        {/* Upload List */}
        {files.length > 0 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
            <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Recent Uploads</h4>
            
            <div className="space-y-3">
              {files.map((file, index) => (
                <Card key={index} className="overflow-hidden">
                  <div className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className="font-medium text-sm truncate">{file.name}</p>
                        {isUploading && uploadProgress < 100 ? (
                          <span className="text-xs text-muted-foreground">{uploadProgress}%</span>
                        ) : (
                          <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400 hover:bg-green-100">
                            <CheckCircle2 className="w-3 h-3 mr-1" /> Ready
                          </Badge>
                        )}
                      </div>
                      
                      {isUploading && uploadProgress < 100 ? (
                        <Progress value={uploadProgress} className="h-1.5" />
                      ) : (
                        <div className="flex items-center text-xs text-muted-foreground gap-4">
                          <span>{(file.size / 1024).toFixed(0)} KB</span>
                          <span>•</span>
                          <span>Uploaded just now</span>
                        </div>
                      )}
                    </div>

                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={(e) => {
                      e.stopPropagation();
                      removeFile(index);
                    }}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Instructions / Help */}
        <div className="grid md:grid-cols-2 gap-4 pt-8 border-t border-border">
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0 font-bold text-sm">1</div>
            <div>
              <h5 className="font-semibold mb-1">Upload Statement</h5>
              <p className="text-sm text-muted-foreground">Upload your full PDF statement. We support scanned and digital PDFs.</p>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0 font-bold text-sm">2</div>
            <div>
              <h5 className="font-semibold mb-1">Auto-Extraction</h5>
              <p className="text-sm text-muted-foreground">Our engine parses line items, identifies fees, and calculates effective rates.</p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
