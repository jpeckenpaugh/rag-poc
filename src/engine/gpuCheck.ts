export interface GPUSupportResult {
  supported: boolean;
  adapterName?: string;
  reason?: string;
}

/**
 * Checks if WebGPU is supported and available in the current browser environment.
 * Attempts to request an adapter to ensure the hardware supports WebGPU.
 */
export async function checkWebGPUSupport(): Promise<GPUSupportResult> {
  if (typeof navigator === 'undefined') {
    return {
      supported: false,
      reason: 'Browser navigator API is not available (non-browser environment).',
    };
  }

  // Check if navigator.gpu exists
  const nav = navigator as Navigator & {
    gpu?: {
      requestAdapter: (options?: unknown) => Promise<{
        info?: {
          vendor?: string;
          architecture?: string;
          device?: string;
          description?: string;
        };
        requestAdapterInfo?: () => Promise<{
          vendor?: string;
          architecture?: string;
          device?: string;
          description?: string;
        }>;
      } | null>;
    };
  };

  if (!nav.gpu) {
    return {
      supported: false,
      reason:
        'WebGPU is not supported in this browser. Please use a modern WebGPU-enabled browser such as Chrome 113+ or Edge 113+.',
    };
  }

  try {
    const adapter = await nav.gpu.requestAdapter();
    if (!adapter) {
      return {
        supported: false,
        reason:
          'WebGPU API is present but no compatible GPU adapter was found. Hardware acceleration may be disabled or unsupported.',
      };
    }

    let adapterName = 'Compatible WebGPU Adapter';
    try {
      if (typeof adapter.requestAdapterInfo === 'function') {
        const info = await adapter.requestAdapterInfo();
        const parts = [info.vendor, info.architecture, info.description || info.device].filter(Boolean);
        if (parts.length > 0) {
          adapterName = parts.join(' ');
        }
      } else if (adapter.info) {
        const parts = [adapter.info.vendor, adapter.info.architecture, adapter.info.description || adapter.info.device].filter(Boolean);
        if (parts.length > 0) {
          adapterName = parts.join(' ');
        }
      }
    } catch {
      // Fallback adapterName is already set
    }

    return {
      supported: true,
      adapterName,
    };
  } catch (error) {
    return {
      supported: false,
      reason: `Failed to initialize WebGPU adapter: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
