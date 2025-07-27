import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapTab } from "./MapTab";
import { ReportsTab } from "./ReportsTab";
import { MapPreview } from "./MapPreview";
import { template, genTemplate } from "@/lib/api";
import { toast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { useErrorHandler } from "@/hooks/useErrorHandler";
import { ComponentErrorBoundary } from "@/components/ErrorBoundary";
import { validateRequired } from "@/lib/error-handling";
import { ValidationErrorDisplay, InlineError } from "@/components/ui/error-display";

interface PermitDrawerProps {
  sessionId?: string;
  notebookId?: string;
  onTemplateCreated?: (id: string) => void;
}

export const PermitDrawer = ({ sessionId, notebookId, onTemplateCreated }: PermitDrawerProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [preview, setPreview] = useState<string>('');
  const [download, setDownload] = useState<string>('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string>("");
  const { handleAsyncError } = useErrorHandler();
  
  const { register, handleSubmit, watch, reset } = useForm({
    defaultValues: {
      permitType: "",
      address: "",
      applicant: ""
    }
  });

  const watchedAddress = watch("address");

  const onSubmit = async (data: any) => {
    setFormErrors({});
    setSubmitError("");
    
    try {
      const errors: Record<string, string> = {};
      
      if (!data.permitType) errors.permitType = 'Please select a permit type';
      if (!data.address?.trim()) errors.address = 'Property address is required';
      if (!data.applicant?.trim()) errors.applicant = 'Applicant name is required';
      
      if (Object.keys(errors).length > 0) {
        setFormErrors(errors);
        return;
      }
    } catch (error) {
      setSubmitError(error.message || "Please fill in all required fields");
      return;
    }

    setIsSubmitting(true);
    
    try {
      const result = await handleAsyncError(
        () => genTemplate({
          ...data,
          sessionId: sessionId || ""
        }),
        { operation: 'generate_template', permitType: data.permitType }
      );
      
      setPreview(result.preview_url);
      setDownload(result.docx_url);
      
      toast({
        title: "Template ready",
        description: `Your ${data.permitType} template has been generated successfully.`,
      });
      
      if (onTemplateCreated) {
        onTemplateCreated(result.report_generation_id || result.docx_url);
      }
      
      reset();
    } catch (error) {
      setSubmitError(error.message || "Failed to generate template. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ComponentErrorBoundary>
      <div className="space-y-4 p-4">
        <div>
          <Tabs defaultValue="form" className="flex flex-col h-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="form">Form</TabsTrigger>
              <TabsTrigger value="map">Map</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
            </TabsList>
            
            <TabsContent value="form" className="flex-1 overflow-auto">
              <div>
                <h3 className="text-sm font-medium text-foreground mb-3">
                  Permit Template Generator
                </h3>
                
                {/* Form Errors */}
                {Object.keys(formErrors).length > 0 && (
                  <div className="mb-4">
                    <ValidationErrorDisplay errors={formErrors} />
                  </div>
                )}
                
                {/* Submit Error */}
                {submitError && (
                  <div className="mb-4">
                    <InlineError 
                      message={submitError} 
                      retry={() => setSubmitError("")}
                    />
                  </div>
                )}
                
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="permitType">Permit Type</Label>
                    <Select {...register("permitType")} data-testid="permit-type-select">
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border shadow-lg z-50">
                        <SelectItem value="building">Building Permit</SelectItem>
                        <SelectItem value="zoning">Zoning Variance</SelectItem>
                        <SelectItem value="subdivision">Subdivision</SelectItem>
                        <SelectItem value="site-plan">Site Plan Review</SelectItem>
                        <SelectItem value="special-use">Special Use Permit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Property Address</Label>
                    <Input
                      id="address"
                      {...register("address")}
                      placeholder="Enter property address"
                      className="bg-background"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="applicant">Applicant Name</Label>
                    <Input
                      id="applicant"
                      {...register("applicant")}
                      placeholder="Enter applicant name"
                      className="bg-background"
                    />
                  </div>

                  <MapPreview address={watchedAddress} />

                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Generating..." : "Generate Template"}
                  </Button>
                  
                  {download && (
                    <Button 
                      variant="outline" 
                      className="w-full mt-2"
                      onClick={() => window.open(download, '_blank')}
                      data-testid="template-preview"
                    >
                      Download Template
                    </Button>
                  )}
                  
                  {preview && (
                    <Button 
                      variant="ghost" 
                      className="w-full mt-1"
                      onClick={() => window.open(preview, '_blank')}
                    >
                      Preview Template
                    </Button>
                  )}
                </form>
              </div>
            </TabsContent>
            
            <TabsContent value="map" className="flex-1 overflow-auto">
                {sessionId ? (
                  <MapTab sessionId={sessionId} />
                ) : (
                  <div className="text-center py-8 px-4">
                    <p className="text-sm text-muted-foreground">
                      Session required for map functionality
                    </p>
                  </div>
                )}
            </TabsContent>
            
            <TabsContent value="reports" className="flex-1 overflow-auto">
                {notebookId ? (
                  <ReportsTab notebookId={notebookId} />
                ) : (
                  <div className="text-center py-8 px-4">
                    <p className="text-sm text-muted-foreground">
                      Notebook required for reports functionality
                    </p>
                  </div>
                )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </ComponentErrorBoundary>
  );
};