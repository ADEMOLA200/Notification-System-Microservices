const logger = require('./logger');

class RetryHandler {
  constructor(maxRetries = 5, baseDelay = 1000, maxDelay = 32000) {
    this.maxRetries = maxRetries;
    this.baseDelay = baseDelay;
    this.maxDelay = maxDelay;
  }

  calculateDelay(attempt) {
    const exponentialDelay = this.baseDelay * Math.pow(2, attempt);
    const jitter = Math.random() * 1000;
    return Math.min(exponentialDelay + jitter, this.maxDelay);
  }

  async executeWithRetry(fn, context = {}) {
    let lastError;
    
    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        logger.info('Attempting operation', { 
          attempt: attempt + 1, 
          maxRetries: this.maxRetries,
          ...context 
        });

        const result = await fn();
        
        if (attempt > 0) {
          logger.info('Operation succeeded after retries', { 
            attempt: attempt + 1,
            ...context 
          });
        }
        
        return { success: true, result, attempts: attempt + 1 };
      } catch (error) {
        lastError = error;
        
        logger.warn('Operation failed, preparing retry', {
          attempt: attempt + 1,
          maxRetries: this.maxRetries,
          error: error.message,
          ...context
        });

        if (attempt < this.maxRetries - 1) {
          const delay = this.calculateDelay(attempt);
          logger.info('Waiting before retry', { 
            delay: `${delay}ms`,
            nextAttempt: attempt + 2,
            ...context 
          });
          await this.sleep(delay);
        }
      }
    }

    logger.error('All retry attempts exhausted', {
      totalAttempts: this.maxRetries,
      finalError: lastError.message,
      ...context
    });

    return { 
      success: false, 
      error: lastError, 
      attempts: this.maxRetries 
    };
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  isRetryableError(error) {
    if (!error) return false;

    const retryableStatusCodes = [408, 429, 500, 502, 503, 504];
    const retryableErrorCodes = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ECONNREFUSED',
      'ENOTFOUND',
      'ENETUNREACH',
      'EAI_AGAIN'
    ];

    if (error.response && retryableStatusCodes.includes(error.response.status)) {
      return true;
    }

    if (error.code && retryableErrorCodes.includes(error.code)) {
      return true;
    }

    if (error.message && error.message.includes('timeout')) {
      return true;
    }

    return false;
  }
}

module.exports = RetryHandler;
