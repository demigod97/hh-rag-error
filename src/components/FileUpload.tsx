// src/components/FileUpload.tsx
import { useState, useCallback } from 'react'
import { Upload, File, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { uploadAndProcessFile, getProcessingJobStatus, subscribeToProcessingJob } from '../lib/api'
import type { ProcessingJob } from '../lib/api'

interface FileUploadProps {
  notebookId: string
  onUploadComplete?: (uploadId: string) => void
}

export function FileUpload({ notebookId, onUploadComplete }: FileUploadProps) {
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [jobs, setJobs] = useState<Record<string, ProcessingJob>>({})

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      file => file.type === 'application/pdf'
    )
    setFiles(prev => [...prev, ...droppedFiles])
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      setFiles(prev => [...prev, ...selectedFiles])
    }
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const uploadFiles = async () => {
    setUploading(true)
    
    for (const file of files) {
      try {
        const { uploadId, jobId } = await uploadAndProcessFile(file, notebookId)
        
        // Subscribe to job updates
        const subscription = subscribeToProcessingJob(jobId, (job) => {
          setJobs(prev => ({ ...prev, [jobId]: job }))
          
          if (job.status === 'completed' && onUploadComplete) {
            onUploadComplete(uploadId)
          }
        })

        // Get initial status
        const status = await getProcessingJobStatus(jobId)
        if (status) {
          setJobs(prev => ({ ...prev, [jobId]: status }))
        }
      } catch (error) {
        console.error('Upload failed:', error)
        setJobs(prev => ({ 
          ...prev, 
          [file.name]: { 
            id: file.name, 
            status: 'failed', 
            progress: 0, 
            error_message: error.message 
          } 
        }))
      }
    }
    
    setUploading(false)
    setFiles([])
  }

  const getJobIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-500" />
      case 'processing':
        return <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
      default:
        return <File className="w-5 h-5 text-gray-400" />
    }
  }

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors"
      >
        <Upload className="w-8 h-8 mx-auto mb-2 text-gray-400" />
        <p className="text-sm text-gray-600 mb-2">
          Drag and drop PDF files here, or click to select
        </p>
        <input
          type="file"
          accept=".pdf"
          multiple
          onChange={handleFileSelect}
          className="hidden"
          id="file-upload"
        />
        <label
          htmlFor="file-upload"
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer"
        >
          Select Files
        </label>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <File className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-gray-500">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              <button
                onClick={() => removeFile(index)}
                className="p-1 hover:bg-gray-200 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          
          <button
            onClick={uploadFiles}
            disabled={uploading}
            className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
            Upload {files.length} file{files.length > 1 ? 's' : ''}
          </button>
        </div>
      )}

      {/* Processing Jobs */}
      {Object.keys(jobs).length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Processing Status</h3>
          {Object.entries(jobs).map(([jobId, job]) => (
            <div
              key={jobId}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center gap-3">
                {getJobIcon(job.status)}
                <div>
                  <p className="text-sm font-medium">
                    {job.status === 'processing' ? 'Processing...' : job.status}
                  </p>
                  {job.error_message && (
                    <p className="text-xs text-red-600">{job.error_message}</p>
                  )}
                </div>
              </div>
              {job.status === 'processing' && job.progress > 0 && (
                <div className="w-32">
                  <div className="bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${job.progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}