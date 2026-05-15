/**
 * BaseService — Abstract base class for all application services.
 * 
 * OOP Principles Demonstrated:
 * • ABSTRACTION:    Common interface for all services
 * • ENCAPSULATION:  Private fields (#serviceName, #initialized)
 * • INHERITANCE:    EmailService, CertificateService, QRService extend this
 * • POLYMORPHISM:   Each subclass overrides initialize() differently
 */
class BaseService {
  #serviceName;
  #initialized;

  constructor(serviceName) {
    if (new.target === BaseService) {
      throw new Error('BaseService is abstract and cannot be instantiated directly.');
    }
    this.#serviceName = serviceName;
    this.#initialized = false;
  }

  get serviceName() { return this.#serviceName; }
  get isInitialized() { return this.#initialized; }

  log(message, ...args) {
    console.log(`[${this.#serviceName}] ${message}`, ...args);
  }

  logError(message, ...args) {
    console.error(`[${this.#serviceName} ERROR] ${message}`, ...args);
  }

  validateRequired(params, requiredFields) {
    for (const field of requiredFields) {
      if (params[field] === undefined || params[field] === null || params[field] === '') {
        throw new Error(`Missing required field: ${field}`);
      }
    }
  }

  async initialize() {
    this.#initialized = true;
    this.log('Service initialized');
    return true;
  }

  async executeWithErrorHandling(operation, errorMessage = 'Operation failed') {
    try {
      return await operation();
    } catch (err) {
      this.logError(`${errorMessage}:`, err.message);
      throw err;
    }
  }

  toString() {
    return `[Service: ${this.#serviceName}] (initialized: ${this.#initialized})`;
  }
}

module.exports = BaseService;
