// Error Handling Strategy for Town Planner Application
import { toast } from "sonner";

// Error Types
export enum ErrorType {
  NETWORK = 'NETWORK',
  API = 'API',
  VALIDATION = 'VALIDATION',
  AUTHENTICATION = 'AUTHENTICATION',
  PERMISSION = 'PERMISSION',
  FILE_UPLOAD = 'FILE_UPLOAD',
  PROCESSING = 'PROCESSING',
  STORAGE = 'STORAGE',
  LLM_PROVIDER = 'LLM_PROVIDER',
  UNKNOWN = 'UNKNOWN'
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface AppError {
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  userMessage: string;
  code?: string;
  details?: any;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  context?: Record<string, any>;
  retryable?: boolean;
  fallbackAction?: () => void;
}

// Error Logger with local storage and external service integration
class ErrorLogger {
  private static instance: ErrorLogger;
  private errors: AppError[] = [];
  private maxErrors = 100;
  private isOnline = navigator.onLine;

  static getInstance(): ErrorLogger {
    if (!ErrorLogger.instance) {
      ErrorLogger.instance = new ErrorLogger();
    }
    return ErrorLogger.instance;
  }

  constructor() {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.flushOfflineErrors();
    });
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    // Load persisted errors
    this.loadPersistedErrors();
  }

  log(error: AppError): void {
    // Add to local storage
    this.errors.unshift(error);
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(0, this.maxErrors);
    }

    // Persist to localStorage
    this.persistErrors();

    // Log to console in development
    if (import.meta.env.DEV) {
      console.error('App Error:', error);
    }

    // Send to external logging service if online
    if (this.isOnline) {
      this.sendToLoggingService(error);
    }
  }

  private persistErrors(): void {
    try {
      const errorsToStore = this.errors.slice(0, 20).map(error => ({
        ...error,
        timestamp: error.timestamp.toISOString()
      }));
      localStorage.setItem('app_errors', JSON.stringify(errorsToStore));
    } catch (e) {
      console.warn('Failed to persist errors to localStorage');
    }
  }

  private loadPersistedErrors(): void {
    try {
      const stored = localStorage.getItem('app_errors');
      if (stored) {
        const parsedErrors = JSON.parse(stored);
        this.errors = parsedErrors.map((error: any) => ({
          ...error,
          timestamp: new Date(error.timestamp)
        }));
      }
    } catch (e) {
      console.warn('Failed to load persisted errors');
    }
  }

  private async sendToLoggingService(error: AppError): Promise<void> {
    // Only send critical and high severity errors to external service
    if (error.severity === ErrorSeverity.CRITICAL || error.severity === ErrorSeverity.HIGH) {
      try {
        // Send to Supabase edge function for logging
        await fetch('/api/errors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...error,
            timestamp: error.timestamp.toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href
          })
        });
      } catch (e) {
        console.warn('Failed to send error to logging service');
      }
    }
  }

  private async flushOfflineErrors(): Promise<void> {
    // Send any errors that occurred while offline
    const offlineErrors = this.errors.filter(error => 
      error.context?.offline === true
    );

    for (const error of offlineErrors) {
      await this.sendToLoggingService(error);
    }
  }

  getErrors(): AppError[] {
    return [...this.errors];
  }

  clearErrors(): void {
    this.errors = [];
    localStorage.removeItem('app_errors');
  }

  getErrorStats(): { total: number; bySeverity: Record<string, number>; byType: Record<string, number> } {
    const stats = {
      total: this.errors.length,
      bySeverity: {} as Record<string, number>,
      byType: {} as Record<string, number>
    };

    this.errors.forEach(error => {
      stats.bySeverity[error.severity] = (stats.bySeverity[error.severity] || 0) + 1;
      stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
    });

    return stats;
  }
}

// Enhanced Error Handler Class
export class ErrorHandler {
  private static logger = ErrorLogger.getInstance();

  static handle(error: any, context?: Record<string, any>): AppError {
    const appError = this.createAppError(error, context);
    this.logger.log(appError);
    this.showUserNotification(appError);
    return appError;
  }

  private static createAppError(error: any, context?: Record<string, any>): AppError {
    const timestamp = new Date();
    const isOffline = !navigator.onLine;
    
    // Network errors
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      return {
        type: ErrorType.NETWORK,
        severity: isOffline ? ErrorSeverity.MEDIUM : ErrorSeverity.HIGH,
        message: error.message,
        userMessage: isOffline 
          ? 'You appear to be offline. Changes will be saved when connection is restored.'
          : 'Connection problem. Please check your internet connection and try again.',
        timestamp,
        context: { ...context, offline: isOffline },
        retryable: true
      };
    }

    // Supabase API errors
    if (error.code && typeof error.code === 'string') {
      return this.handleSupabaseError(error, timestamp, context);
    }

    // File upload errors
    if (context?.operation === 'file_upload') {
      return {
        type: ErrorType.FILE_UPLOAD,
        severity: ErrorSeverity.MEDIUM,
        message: error.message,
        userMessage: this.getFileUploadErrorMessage(error),
        timestamp,
        context,
        retryable: true
      };
    }

    // LLM Provider errors
    if (context?.operation?.includes('llm') || error.message?.includes('LLM')) {
      return {
        type: ErrorType.LLM_PROVIDER,
        severity: ErrorSeverity.MEDIUM,
        message: error.message,
        userMessage: 'AI service temporarily unavailable. Trying alternative provider...',
        timestamp,
        context,
        retryable: true,
        fallbackAction: () => this.tryFallbackLLMProvider(context)
      };
    }

    // Validation errors
    if (error.name === 'ValidationError' || context?.operation === 'validation') {
      return {
        type: ErrorType.VALIDATION,
        severity: ErrorSeverity.LOW,
        message: error.message,
        userMessage: error.field 
          ? `Please check the ${error.field} field and try again.`
          : 'Please check your input and try again.',
        timestamp,
        context,
        retryable: false
      };
    }

    // Authentication errors
    if (error.message?.includes('auth') || error.message?.includes('unauthorized')) {
      return {
        type: ErrorType.AUTHENTICATION,
        severity: ErrorSeverity.HIGH,
        message: error.message,
        userMessage: 'Your session has expired. Please log in again.',
        timestamp,
        context,
        retryable: false
      };
    }

    // Storage errors
    if (error.message?.includes('storage') || context?.operation?.includes('storage')) {
      return {
        type: ErrorType.STORAGE,
        severity: ErrorSeverity.MEDIUM,
        message: error.message,
        userMessage: 'File storage error. Please try again or contact support.',
        timestamp,
        context,
        retryable: true
      };
    }

    // Default unknown error
    return {
      type: ErrorType.UNKNOWN,
      severity: ErrorSeverity.MEDIUM,
      message: error.message || 'Unknown error occurred',
      userMessage: 'Something went wrong. Please try again or contact support if the problem persists.',
      timestamp,
      context,
      retryable: true
    };
  }

  private static handleSupabaseError(error: any, timestamp: Date, context?: Record<string, any>): AppError {
    const code = error.code;
    
    switch (code) {
      case '42703': // Column does not exist
        return {
          type: ErrorType.API,
          severity: ErrorSeverity.HIGH,
          message: `Database schema error: ${error.message}`,
          userMessage: 'A technical issue occurred. Our team has been notified.',
          code,
          timestamp,
          context,
          retryable: false
        };
      
      case '22P02': // Invalid UUID
        return {
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.MEDIUM,
          message: `Invalid ID format: ${error.message}`,
          userMessage: 'Invalid data format. Please refresh the page and try again.',
          code,
          timestamp,
          context,
          retryable: false
        };
      
      case '23505': // Unique constraint violation
        return {
          type: ErrorType.VALIDATION,
          severity: ErrorSeverity.LOW,
          message: `Duplicate entry: ${error.message}`,
          userMessage: 'This item already exists. Please use a different name or value.',
          code,
          timestamp,
          context,
          retryable: false
        };
      
      case 'PGRST116': // No rows returned
        return {
          type: ErrorType.API,
          severity: ErrorSeverity.LOW,
          message: 'No data found',
          userMessage: 'No data found for your request.',
          code,
          timestamp,
          context,
          retryable: false
        };

      case '23503': // Foreign key violation
        return {
          type: ErrorType.API,
          severity: ErrorSeverity.MEDIUM,
          message: `Data relationship error: ${error.message}`,
          userMessage: 'Unable to complete operation due to data dependencies.',
          code,
          timestamp,
          context,
          retryable: false
        };
      
      default:
        return {
          type: ErrorType.API,
          severity: ErrorSeverity.MEDIUM,
          message: error.message,
          userMessage: 'A server error occurred. Please try again in a moment.',
          code,
          timestamp,
          context,
          retryable: true
        };
    }
  }

  private static getFileUploadErrorMessage(error: any): string {
    if (error.message?.includes('size')) {
      return 'File is too large. Please choose a smaller file (max 50MB).';
    }
    if (error.message?.includes('type') || error.message?.includes('format')) {
      return 'Invalid file format. Please upload a PDF file.';
    }
    if (error.message?.includes('network')) {
      return 'Upload failed due to connection issues. Please try again.';
    }
    return 'File upload failed. Please check the file and try again.';
  }

  private static async tryFallbackLLMProvider(context?: Record<string, any>): Promise<void> {
    // Implement LLM provider fallback logic
    const fallbackProviders = ['ollama', 'openai', 'gemini'];
    const currentProvider = context?.llmProvider;
    
    const nextProvider = fallbackProviders.find(p => p !== currentProvider);
    if (nextProvider) {
      toast(`Switching to ${nextProvider} provider...`, {
        description: 'Attempting to continue with alternative AI service.'
      });
    }
  }

  private static showUserNotification(error: AppError): void {
    const duration = error.severity === ErrorSeverity.LOW ? 3000 : 5000;
    
    if (error.severity === ErrorSeverity.CRITICAL) {
      toast.error(error.userMessage, {
        description: 'Please contact support if this issue persists.',
        duration: 10000,
        action: error.retryable ? {
          label: 'Retry',
          onClick: error.fallbackAction || (() => window.location.reload())
        } : undefined
      });
    } else if (error.severity === ErrorSeverity.HIGH) {
      toast.error(error.userMessage, {
        duration,
        action: error.retryable ? {
          label: 'Retry',
          onClick: error.fallbackAction || (() => {})
        } : undefined
      });
    } else if (error.severity === ErrorSeverity.MEDIUM) {
      toast.warning(error.userMessage, { duration });
    } else {
      toast(error.userMessage, { duration });
    }
  }

  static getLogger(): ErrorLogger {
    return this.logger;
  }
}

// Enhanced Retry mechanism with exponential backoff and circuit breaker
export class RetryHandler {
  private static circuitBreakers = new Map<string, CircuitBreaker>();

  static async withRetry<T>(
    operation: () => Promise<T>,
    options: {
      maxRetries?: number;
      delay?: number;
      backoff?: number;
      operationId?: string;
      shouldRetry?: (error: any) => boolean;
    } = {}
  ): Promise<T> {
    const {
      maxRetries = 3,
      delay = 1000,
      backoff = 2,
      operationId,
      shouldRetry = this.defaultShouldRetry
    } = options;

    // Check circuit breaker if operation ID provided
    if (operationId) {
      const circuitBreaker = this.getCircuitBreaker(operationId);
      if (circuitBreaker.isOpen()) {
        throw new Error(`Circuit breaker open for operation: ${operationId}`);
      }
    }

    let lastError: any;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await operation();
        
        // Reset circuit breaker on success
        if (operationId) {
          this.getCircuitBreaker(operationId).recordSuccess();
        }
        
        return result;
      } catch (error) {
        lastError = error;
        
        // Record failure in circuit breaker
        if (operationId) {
          this.getCircuitBreaker(operationId).recordFailure();
        }
        
        // Don't retry on certain error types
        if (!shouldRetry(error)) {
          throw error;
        }
        
        if (attempt === maxRetries) {
          break;
        }
        
        // Wait before retrying with exponential backoff
        const waitTime = delay * Math.pow(backoff, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    throw lastError;
  }

  private static defaultShouldRetry(error: any): boolean {
    // Don't retry validation errors, authentication errors, or 4xx errors
    if (error.code === '22P02' || error.code === '23505') return false;
    if (error.message?.includes('auth') || error.message?.includes('unauthorized')) return false;
    if (error.status >= 400 && error.status < 500) return false;
    if (error.name === 'ValidationError') return false;
    return true;
  }

  private static getCircuitBreaker(operationId: string): CircuitBreaker {
    if (!this.circuitBreakers.has(operationId)) {
      this.circuitBreakers.set(operationId, new CircuitBreaker(operationId));
    }
    return this.circuitBreakers.get(operationId)!;
  }
}

// Circuit Breaker implementation
class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  constructor(
    private operationId: string,
    private failureThreshold = 5,
    private timeout = 60000 // 1 minute
  ) {}

  isOpen(): boolean {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
        return false;
      }
      return true;
    }
    return false;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }

  recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      console.warn(`Circuit breaker opened for operation: ${this.operationId}`);
    }
  }
}

// Network status monitoring with enhanced offline support
export class NetworkMonitor {
  private static instance: NetworkMonitor;
  private isOnline: boolean = navigator.onLine;
  private listeners: ((online: boolean) => void)[] = [];
  private connectionQuality: 'fast' | 'slow' | 'offline' = 'fast';

  static getInstance(): NetworkMonitor {
    if (!NetworkMonitor.instance) {
      NetworkMonitor.instance = new NetworkMonitor();
    }
    return NetworkMonitor.instance;
  }

  constructor() {
    window.addEventListener('online', () => this.setOnlineStatus(true));
    window.addEventListener('offline', () => this.setOnlineStatus(false));
    
    // Monitor connection quality
    this.monitorConnectionQuality();
  }

  private setOnlineStatus(online: boolean): void {
    const wasOffline = !this.isOnline;
    this.isOnline = online;
    this.listeners.forEach(listener => listener(online));
    
    if (online && wasOffline) {
      toast.success('Connection restored', {
        description: 'You are back online. Syncing data...',
        duration: 3000,
      });
      
      // Trigger offline queue processing
      OfflineQueue.getInstance().processQueue();
    } else if (!online) {
      toast.warning('Connection lost', {
        description: 'You are currently offline. Changes will be saved locally.',
        duration: 5000,
      });
    }
  }

  private monitorConnectionQuality(): void {
    // Use Network Information API if available
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      
      const updateConnectionQuality = () => {
        if (!this.isOnline) {
          this.connectionQuality = 'offline';
        } else if (connection.effectiveType === '4g' || connection.effectiveType === 'wifi') {
          this.connectionQuality = 'fast';
        } else {
          this.connectionQuality = 'slow';
        }
      };

      connection.addEventListener('change', updateConnectionQuality);
      updateConnectionQuality();
    }
  }

  isOnlineStatus(): boolean {
    return this.isOnline;
  }

  getConnectionQuality(): 'fast' | 'slow' | 'offline' {
    return this.connectionQuality;
  }

  onStatusChange(listener: (online: boolean) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
}

// Enhanced offline storage for failed operations
export class OfflineQueue {
  private static instance: OfflineQueue;
  private queue: Array<{
    id: string;
    operation: string;
    data: any;
    timestamp: Date;
    retryCount: number;
    priority: 'low' | 'medium' | 'high';
  }> = [];

  static getInstance(): OfflineQueue {
    if (!OfflineQueue.instance) {
      OfflineQueue.instance = new OfflineQueue();
      OfflineQueue.instance.loadFromStorage();
    }
    return OfflineQueue.instance;
  }

  addToQueue(
    operation: string, 
    data: any, 
    priority: 'low' | 'medium' | 'high' = 'medium'
  ): string {
    const id = crypto.randomUUID();
    const item = {
      id,
      operation,
      data,
      timestamp: new Date(),
      retryCount: 0,
      priority
    };
    
    this.queue.push(item);
    this.queue.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
    
    this.saveToStorage();
    
    toast(`Operation queued for when you're back online`, {
      description: `${operation} will be processed automatically.`
    });
    
    return id;
  }

  async processQueue(): Promise<void> {
    if (!NetworkMonitor.getInstance().isOnlineStatus()) {
      return;
    }

    const itemsToProcess = [...this.queue];
    let processedCount = 0;
    
    for (const item of itemsToProcess) {
      try {
        await this.processQueueItem(item);
        this.removeFromQueue(item.id);
        processedCount++;
      } catch (error) {
        item.retryCount++;
        if (item.retryCount >= 3) {
          this.removeFromQueue(item.id);
          ErrorHandler.handle(error, { 
            operation: 'offline_queue_processing',
            queueItem: item 
          });
        }
      }
    }
    
    if (processedCount > 0) {
      toast.success(`Synced ${processedCount} offline changes`, {
        description: 'Your data has been updated.'
      });
    }
    
    this.saveToStorage();
  }

  private async processQueueItem(item: any): Promise<void> {
    // Import API functions dynamically to avoid circular dependencies
    const { uploadFile, sendChatMessage, updateUserSettings } = await import('./api');
    
    switch (item.operation) {
      case 'upload_file':
        await uploadFile(item.data.file, item.data.notebookId, item.data.userQuery);
        break;
      case 'send_message':
        await sendChatMessage(item.data.sessionId, item.data.message);
        break;
      case 'update_settings':
        await updateUserSettings(item.data.settings);
        break;
      default:
        throw new Error(`Unknown operation: ${item.operation}`);
    }
  }

  private removeFromQueue(id: string): void {
    this.queue = this.queue.filter(item => item.id !== id);
  }

  private saveToStorage(): void {
    try {
      const serializedQueue = this.queue.map(item => ({
        ...item,
        timestamp: item.timestamp.toISOString()
      }));
      localStorage.setItem('offline_queue', JSON.stringify(serializedQueue));
    } catch (e) {
      console.warn('Failed to save offline queue');
    }
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem('offline_queue');
      if (stored) {
        const parsedQueue = JSON.parse(stored);
        this.queue = parsedQueue.map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp)
        }));
      }
    } catch (e) {
      console.warn('Failed to load offline queue');
    }
  }

  getQueueStatus(): { count: number; oldestItem?: Date } {
    return {
      count: this.queue.length,
      oldestItem: this.queue.length > 0 ? this.queue[this.queue.length - 1].timestamp : undefined
    };
  }
}

// Validation helpers with enhanced error messages
export class ValidationError extends Error {
  constructor(message: string, public field?: string, public code?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export const validateRequired = (value: any, fieldName: string): void => {
  if (!value || (typeof value === 'string' && value.trim() === '')) {
    throw new ValidationError(`${fieldName} is required`, fieldName, 'REQUIRED');
  }
};

export const validateEmail = (email: string): void => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new ValidationError('Please enter a valid email address', 'email', 'INVALID_EMAIL');
  }
};

export const validateFileSize = (file: File, maxSizeMB: number): void => {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    throw new ValidationError(
      `File size must be less than ${maxSizeMB}MB (current: ${(file.size / 1024 / 1024).toFixed(1)}MB)`, 
      'file', 
      'FILE_TOO_LARGE'
    );
  }
};

export const validateFileType = (file: File, allowedTypes: string[]): void => {
  if (!allowedTypes.includes(file.type)) {
    throw new ValidationError(
      `File type must be one of: ${allowedTypes.join(', ')} (current: ${file.type})`, 
      'file', 
      'INVALID_FILE_TYPE'
    );
  }
};

export const validateNotebookName = (name: string): void => {
  validateRequired(name, 'Notebook name');
  if (name.length > 100) {
    throw new ValidationError('Notebook name must be less than 100 characters', 'name', 'TOO_LONG');
  }
  if (!/^[a-zA-Z0-9\s\-_]+$/.test(name)) {
    throw new ValidationError('Notebook name contains invalid characters', 'name', 'INVALID_CHARACTERS');
  }
};

// Graceful degradation helpers
export class GracefulDegradation {
  static async withFallback<T>(
    primaryOperation: () => Promise<T>,
    fallbackOperation: () => Promise<T> | T,
    context?: string
  ): Promise<T> {
    try {
      return await primaryOperation();
    } catch (error) {
      console.warn(`Primary operation failed (${context}), using fallback:`, error);
      
      toast.warning('Using simplified mode', {
        description: 'Some features may be limited due to connectivity issues.'
      });
      
      return await fallbackOperation();
    }
  }

  static createOfflineComponent<T>(
    onlineComponent: T,
    offlineComponent: T,
    isOnline: boolean = navigator.onLine
  ): T {
    return isOnline ? onlineComponent : offlineComponent;
  }
}

// Performance monitoring and error correlation
export class PerformanceMonitor {
  private static metrics = new Map<string, number[]>();

  static recordOperation(operationName: string, duration: number): void {
    if (!this.metrics.has(operationName)) {
      this.metrics.set(operationName, []);
    }
    
    const times = this.metrics.get(operationName)!;
    times.push(duration);
    
    // Keep only last 100 measurements
    if (times.length > 100) {
      times.shift();
    }
    
    // Alert on performance degradation
    if (times.length >= 10) {
      const average = times.reduce((a, b) => a + b, 0) / times.length;
      const recent = times.slice(-5).reduce((a, b) => a + b, 0) / 5;
      
      if (recent > average * 2) {
        console.warn(`Performance degradation detected for ${operationName}: ${recent}ms vs ${average}ms average`);
      }
    }
  }

  static async measureOperation<T>(
    operationName: string,
    operation: () => Promise<T>
  ): Promise<T> {
    const start = performance.now();
    try {
      const result = await operation();
      const duration = performance.now() - start;
      this.recordOperation(operationName, duration);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.recordOperation(`${operationName}_error`, duration);
      throw error;
    }
  }

  static getMetrics(): Record<string, { average: number; count: number; recent: number }> {
    const result: Record<string, { average: number; count: number; recent: number }> = {};
    
    this.metrics.forEach((times, operation) => {
      const average = times.reduce((a, b) => a + b, 0) / times.length;
      const recent = times.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, times.length);
      
      result[operation] = {
        average: Math.round(average),
        count: times.length,
        recent: Math.round(recent)
      };
    });
    
    return result;
  }
}

// Error boundary helper for React components
export const createErrorBoundary = (fallbackComponent: React.ComponentType<any>) => {
  return class ErrorBoundary extends React.Component<
    { children: React.ReactNode },
    { hasError: boolean; error?: Error }
  > {
    constructor(props: { children: React.ReactNode }) {
      super(props);
      this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error) {
      return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
      ErrorHandler.handle(error, {
        operation: 'react_error_boundary',
        errorInfo,
        componentStack: errorInfo.componentStack
      });
    }

    render() {
      if (this.state.hasError) {
        return React.createElement(fallbackComponent, { 
          error: this.state.error,
          retry: () => this.setState({ hasError: false, error: undefined })
        });
      }

      return this.props.children;
    }
  };
};