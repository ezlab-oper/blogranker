// Supabase wrapper that automatically tracks API requests
import { supabase as originalSupabase } from '@/integrations/supabase/client';
import { apiTracker } from './api-tracker';

// Create a proxy to intercept Supabase calls
type SupabaseClient = typeof originalSupabase;

function createTrackedSupabase(): SupabaseClient {
  return new Proxy(originalSupabase, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      
      // Track when accessing data-related methods
      if (prop === 'from') {
        return (...args: Parameters<typeof target.from>) => {
          const result = target.from(...args);
          return createTrackedQueryBuilder(result);
        };
      }
      
      if (prop === 'functions') {
        return new Proxy(target.functions, {
          get(funcTarget, funcProp, funcReceiver) {
            if (funcProp === 'invoke') {
              return (...args: unknown[]) => {
                apiTracker.trackRequest();
                return (funcTarget.invoke as (...args: unknown[]) => unknown)(...args);
              };
            }
            return Reflect.get(funcTarget, funcProp, funcReceiver);
          }
        });
      }
      
      if (prop === 'rpc') {
        return (...args: unknown[]) => {
          apiTracker.trackRequest();
          return (target.rpc as (...args: unknown[]) => unknown)(...args);
        };
      }
      
      return value;
    }
  });
}

// Track query builder operations
function createTrackedQueryBuilder<T>(builder: T): T {
  const executeMethods = ['select', 'insert', 'update', 'delete', 'upsert'];
  const terminalMethods = ['single', 'maybeSingle', 'csv', 'then'];
  
  return new Proxy(builder as object, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      
      if (typeof value === 'function') {
        return (...args: unknown[]) => {
          const result = (value as (...args: unknown[]) => unknown).apply(target, args);
          
          // Track on terminal methods that actually execute the query
          if (terminalMethods.includes(prop as string)) {
            apiTracker.trackRequest();
            return result;
          }
          
          // Continue wrapping for chainable methods
          if (result && typeof result === 'object' && 'then' in result) {
            // It's a promise-like, track it
            if (executeMethods.includes(prop as string)) {
              // If it's a direct select/insert/etc without chaining, track it
              const originalThen = (result as { then: (onfulfilled?: (value: unknown) => unknown) => unknown }).then.bind(result);
              (result as { then: (onfulfilled?: (value: unknown) => unknown) => unknown }).then = (onfulfilled?: (value: unknown) => unknown) => {
                apiTracker.trackRequest();
                return originalThen(onfulfilled);
              };
            }
            return createTrackedQueryBuilder(result);
          }
          
          return createTrackedQueryBuilder(result as object);
        };
      }
      
      return value;
    }
  }) as T;
}

export const trackedSupabase = createTrackedSupabase();
