// src/components/SettingsModal.tsx
import { useState, useEffect } from 'react'
import { X, Loader2, Check, AlertCircle } from 'lucide-react'
import { updateUserSettings, testLLMConnection, getUserSettings } from '../lib/api'
import type { LLMSettings } from '../lib/api'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [settings, setSettings] = useState<LLMSettings>({
    provider: 'ollama',
    model: '',
    temperature: 0.3,
    embeddingProvider: 'ollama'
  })
  const [testing, setTesting] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadSettings()
    }
  }, [isOpen])

  const loadSettings = async () => {
    try {
      const userSettings = await getUserSettings()
      setSettings(userSettings)
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateUserSettings(settings)
      onClose()
    } catch (error) {
      console.error('Failed to save settings:', error)
    } finally {
      setSaving(false)
    }
  }

  const testConnection = async (provider: string) => {
    setTesting(provider)
    try {
      const result = await testLLMConnection(provider, settings)
      setTestResults({ ...testResults, [provider]: result.success })
    } catch (error) {
      setTestResults({ ...testResults, [provider]: false })
    } finally {
      setTesting(null)
    }
  }

  const providers = [
    { 
      id: 'ollama', 
      name: 'Ollama (Local)', 
      models: ['qwen3:8b-q4_K_M', 'llama3.2', 'mistral', 'phi3']
    },
    { 
      id: 'openai', 
      name: 'OpenAI', 
      models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo']
    },
    { 
      id: 'gemini', 
      name: 'Google Gemini', 
      models: ['gemini-pro', 'gemini-1.5-pro', 'gemini-1.5-flash']
    },
    { 
      id: 'llamacloud', 
      name: 'LlamaCloud (PDF Processing)', 
      models: []
    }
  ]

  const selectedProvider = providers.find(p => p.id === settings.provider)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold">Settings</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* LLM Provider Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">
              LLM Provider
            </label>
            <select
              value={settings.provider}
              onChange={(e) => setSettings({ ...settings, provider: e.target.value as any })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {providers.map(provider => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </div>

          {/* Model Selection */}
          {selectedProvider && selectedProvider.models.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-2">
                Model
              </label>
              <select
                value={settings.model || ''}
                onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Default</option>
                {selectedProvider.models.map(model => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Temperature */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Temperature: {settings.temperature}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={settings.temperature}
              onChange={(e) => setSettings({ ...settings, temperature: parseFloat(e.target.value) })}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Focused</span>
              <span>Creative</span>
            </div>
          </div>

          {/* Embedding Provider */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Embedding Provider
            </label>
            <select
              value={settings.embeddingProvider || settings.provider}
              onChange={(e) => setSettings({ ...settings, embeddingProvider: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="ollama">Ollama (nomic-embed-text)</option>
              <option value="openai">OpenAI (text-embedding-3-small)</option>
              <option value="gemini">Gemini (embedding-001)</option>
            </select>
          </div>

          {/* Connection Tests */}
          <div className="border-t pt-4">
            <h3 className="font-medium mb-3">Test Connections</h3>
            <div className="space-y-2">
              {providers.filter(p => p.id !== 'llamacloud').map(provider => (
                <div key={provider.id} className="flex items-center justify-between">
                  <span className="text-sm">{provider.name}</span>
                  <button
                    onClick={() => testConnection(provider.id)}
                    disabled={testing === provider.id}
                    className="flex items-center gap-2 px-3 py-1 text-sm border rounded-lg hover:bg-gray-50 disabled:opacity-50"
                  >
                    {testing === provider.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : testResults[provider.id] === true ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : testResults[provider.id] === false ? (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    ) : null}
                    Test
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Provider-specific settings */}
          {settings.provider === 'ollama' && (
            <div className="border-t pt-4">
              <h3 className="font-medium mb-3">Ollama Settings</h3>
              <p className="text-sm text-gray-600">
                Make sure Ollama is running locally at http://localhost:11434
              </p>
              <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                <code className="text-xs">ollama serve</code>
              </div>
            </div>
          )}

          {/* Save Button */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Save Settings
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

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