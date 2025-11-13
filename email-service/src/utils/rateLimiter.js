const logger = require('./logger');

class RateLimiter {
  constructor(options = {}) {
    this.maxRequests = options.maxRequests || 100;
    this.windowMs = options.windowMs || 60000;
    this.name = options.name || 'RateLimiter';
    
    this.requests = [];
  }

  async acquire() {
    const now = Date.now();
    
    this.requests = this.requests.filter(timestamp => now - timestamp < this.windowMs);
    
    if (this.requests.length >= this.maxRequests) {
      const oldestRequest = this.requests[0];
      const waitTime = this.windowMs - (now - oldestRequest);
      
      logger.warn('Rate limit reached, waiting', {
        rateLimiter: this.name,
        currentRequests: this.requests.length,
        maxRequests: this.maxRequests,
        waitTime: `${waitTime}ms`
      });
      
      await this.sleep(waitTime);
      return this.acquire();
    }
    
    this.requests.push(now);
    
    logger.debug('Rate limiter acquired', {
      rateLimiter: this.name,
      currentRequests: this.requests.length,
      maxRequests: this.maxRequests
    });
    
    return true;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStats() {
    const now = Date.now();
    const activeRequests = this.requests.filter(timestamp => now - timestamp < this.windowMs);
    
    return {
      name: this.name,
      activeRequests: activeRequests.length,
      maxRequests: this.maxRequests,
      windowMs: this.windowMs,
      availableSlots: this.maxRequests - activeRequests.length
    };
  }

  reset() {
    this.requests = [];
    logger.info('Rate limiter reset', { rateLimiter: this.name });
  }
}

module.exports = RateLimiter;
