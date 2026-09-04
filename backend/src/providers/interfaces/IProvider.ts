/**
 * Provider Interface - Core abstraction for AI providers
 */

import {
  ProviderCapability,
  ProviderConfig,
  ProviderHealthCheck,
  ValidationResult,
  JobType,
  IJob,
} from '../types';

export interface ProviderInitOptions {
  config: ProviderConfig;
  apiKey?: string;
  apiUrl?: string;
}

/**
 * Core provider interface that all AI providers must implement
 * This allows adding new providers without modifying core system logic
 */
export interface IProvider {
  /**
   * Provider name
   */
  readonly name: string;

  /**
   * List of capabilities this provider supports
   */
  readonly capabilities: ProviderCapability[];

  /**
   * Initialize provider with configuration
   */
  initialize(options: ProviderInitOptions): Promise<void>;

  /**
   * Check if provider is healthy and responsive
   */
  healthCheck(): Promise<ProviderHealthCheck>;

  /**
   * Get current rate limit status
   */
  getRateLimitStatus(): Promise<{
    remaining: number;
    reset: Date;
    limit: number;
  }>;

  /**
   * Execute job based on its type and input
   */
  executeJob(job: IJob): Promise<{
    output: Record<string, any>;
    metadata?: Record<string, any>;
  }>;

  /**
   * Validate input for a specific job type
   */
  validateInput(jobType: JobType, input: Record<string, any>): Promise<ValidationResult>;

  /**
   * Validate provider credentials
   */
  validateCredentials(): Promise<boolean>;

  /**
   * Get supported models for this provider
   */
  getSupportedModels(): Promise<Record<string, string[]>>;
}

/**
 * Base provider class with common functionality
 */
export abstract class BaseProvider implements IProvider {
  abstract readonly name: string;
  abstract readonly capabilities: ProviderCapability[];

  protected config!: ProviderConfig;
  protected apiKey!: string;
  protected apiUrl!: string;

  async initialize(options: ProviderInitOptions): Promise<void> {
    this.config = options.config;
    this.apiKey = options.apiKey || '';
    this.apiUrl = options.apiUrl || '';

    if (!this.apiKey && this.config.enabled) {
      throw new Error(`${this.name} provider requires API key`);
    }

    await this.validateCredentials();
  }

  abstract healthCheck(): Promise<ProviderHealthCheck>;
  abstract getRateLimitStatus(): Promise<{
    remaining: number;
    reset: Date;
    limit: number;
  }>;
  abstract executeJob(job: IJob): Promise<{
    output: Record<string, any>;
    metadata?: Record<string, any>;
  }>;
  abstract validateInput(
    jobType: JobType,
    input: Record<string, any>,
  ): Promise<ValidationResult>;
  abstract validateCredentials(): Promise<boolean>;
  abstract getSupportedModels(): Promise<Record<string, string[]>>;

  protected isCapabilitySupported(capability: ProviderCapability): boolean {
    return this.capabilities.includes(capability);
  }
}
