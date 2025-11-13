const logger = require('./logger');

class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000;
    this.monitoringPeriod = options.monitoringPeriod || 10000;
    this.name = options.name || 'CircuitBreaker';
    
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = Date.now();
    this.lastFailureTime = null;
    
    this.stats = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      rejectedCalls: 0
    };
  }

  async execute(fn, fallback = null) {
    this.stats.totalCalls++;

    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        this.stats.rejectedCalls++;
        logger.warn('Circuit breaker is OPEN, rejecting call', {
          circuitBreaker: this.name,
          state: this.state,
          failureCount: this.failureCount,
          nextAttempt: new Date(this.nextAttempt).toISOString()
        });
        
        if (fallback) {
          return await fallback();
        }
        
        throw new Error(`Circuit breaker ${this.name} is OPEN`);
      } else {
        this.state = 'HALF_OPEN';
        logger.info('Circuit breaker entering HALF_OPEN state', {
          circuitBreaker: this.name
        });
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.stats.successfulCalls++;
    this.failureCount = 0;
    
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      logger.info('Circuit breaker closed after successful call', {
        circuitBreaker: this.name,
        state: this.state
      });
    }
    
    this.successCount++;
  }

  onFailure() {
    this.stats.failedCalls++;
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.successCount = 0;

    logger.warn('Circuit breaker registered failure', {
      circuitBreaker: this.name,
      failureCount: this.failureCount,
      threshold: this.failureThreshold,
      state: this.state
    });

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeout;
      
      logger.error('Circuit breaker opened due to failures', {
        circuitBreaker: this.name,
        state: this.state,
        failureCount: this.failureCount,
        nextAttempt: new Date(this.nextAttempt).toISOString(),
        resetTimeout: `${this.resetTimeout}ms`
      });
    }
  }

  getState() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      stats: this.stats,
      lastFailureTime: this.lastFailureTime ? new Date(this.lastFailureTime).toISOString() : null,
      nextAttempt: this.state === 'OPEN' ? new Date(this.nextAttempt).toISOString() : null
    };
  }

  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = Date.now();
    logger.info('Circuit breaker manually reset', {
      circuitBreaker: this.name
    });
  }
}

module.exports = CircuitBreaker;
