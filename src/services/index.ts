// ============================================
// Services Index
// ============================================

export { 
  mongoDB, 
  redis, 
  initializeDatabases, 
  closeDatabaseConnections,
  checkDatabaseHealth 
} from './database.js';

// ✅ Fixed: Only export instances, not classes (classes are private/singleton)
export { llmService } from './llm.js';
export { multiModalService } from './multimodal.js';
export { notificationService } from './notifications.js';

export { 
  startScheduledJobs, 
  stopScheduledJobs,
  scheduleRecurringJob,
  cancelRecurringJob 
} from './scheduler.js';