/**
 * Routing Layer - Intelligent provider and workflow selection
 */

import {
  JobType,
  ProviderCapability,
  RoutingContext,
  RoutingDecision,
  UserPreferences,
} from '../types';
import { IProvider } from '../providers/interfaces/IProvider';
import logger from './logger';
import { ServiceUnavailableError } from '../types/errors';

/**
 * Routing strategy interface
 */
interface RoutingStrategy {
  selectProvider(
    capabilities: ProviderCapability[],
    availableProviders: IProvider[],
    context: RoutingContext,
  ): Promise<IProvider | null>;
}

/**
 * Default routing strategy - selects provider based on capability, availability, and user preference
 */
class DefaultRoutingStrategy implements RoutingStrategy {
  async selectProvider(
    capabilities: ProviderCapability[],
    availableProviders: IProvider[],
    context: RoutingContext,
  ): Promise<IProvider | null> {
    // Filter providers that support all required capabilities
    const capableProviders = availableProviders.filter((provider) =>
      capabilities.every((cap) => provider.capabilities.includes(cap)),
    );

    if (capableProviders.length === 0) {
      logger.warn(
        `No providers available for capabilities: ${capabilities.join(', ')}`,
      );
      return null;
    }

    // If user has preference, use it if available
    if (context.userPreferences?.defaultProvider) {
      const preferred = capableProviders.find(
        (p) => p.name.toLowerCase() === context.userPreferences?.defaultProvider?.toLowerCase(),
      );
      if (preferred) {
        logger.info(
          `Selected provider ${preferred.name} based on user preference`,
        );
        return preferred;
      }
    }

    // Default: use first available provider
    logger.info(`Selected provider ${capableProviders[0].name} for capabilities`);
    return capableProviders[0];
  }
}

/**
 * Router class - Central routing logic
 */
export class Router {
  private strategy: RoutingStrategy = new DefaultRoutingStrategy();

  /**
   * Map job type to required capabilities
   */
  private getCapabilitiesForJobType(jobType: JobType): ProviderCapability[] {
    const capabilityMap: Record<JobType, ProviderCapability[]> = {
      [JobType.IMAGE_GENERATION]: [ProviderCapability.IMAGE_GENERATION],
      [JobType.VIDEO_GENERATION]: [ProviderCapability.VIDEO_GENERATION],
      [JobType.AUDIO_GENERATION]: [ProviderCapability.AUDIO_GENERATION],
      [JobType.TEXT_TO_SPEECH]: [ProviderCapability.TEXT_TO_SPEECH],
      [JobType.TEXT_GENERATION]: [ProviderCapability.TEXT_GENERATION],
      [JobType.CHARACTER_GENERATION]: [ProviderCapability.CHARACTER_GENERATION],
      [JobType.ASSET_3D_GENERATION]: [ProviderCapability.ASSET_3D_GENERATION],
      [JobType.GAME_CREATION]: [
        // Game creation may require multiple capabilities
        ProviderCapability.IMAGE_GENERATION,
        ProviderCapability.CHARACTER_GENERATION,
        ProviderCapability.ASSET_3D_GENERATION,
      ],
      [JobType.GAME_BUILD]: [ProviderCapability.IMAGE_GENERATION], // Simplified for now
      [JobType.ANIMATION_GENERATION]: [ProviderCapability.ANIMATION_GENERATION],
    };

    return capabilityMap[jobType] || [];
  }

  /**
   * Route a job to the best provider
   */
  async route(
    jobType: JobType,
    availableProviders: IProvider[],
    userPreferences?: UserPreferences,
  ): Promise<RoutingDecision> {
    const capabilities = this.getCapabilitiesForJobType(jobType);
    const context: RoutingContext = {
      jobType,
      capabilities,
      userPreferences,
    };

    const selectedProvider = await this.strategy.selectProvider(
      capabilities,
      availableProviders,
      context,
    );

    if (!selectedProvider) {
      throw new ServiceUnavailableError(
        `No provider available for job type: ${jobType}`,
      );
    }

    return {
      providerId: selectedProvider.name,
      providerName: selectedProvider.name,
      reasoning: `Selected ${selectedProvider.name} based on capability match and availability`,
      fallbackProviders: availableProviders
        .filter((p) => p.name !== selectedProvider.name)
        .map((p) => p.name),
    };
  }

  /**
   * Set custom routing strategy
   */
  setStrategy(strategy: RoutingStrategy): void {
    this.strategy = strategy;
  }
}
