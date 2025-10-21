// src/utils/logger.ts
export function log(...args: any[]) {
  try {
    const message = '[Nanopub Plugin] ' + args.map(a => {
      if (typeof a === 'object') {
        try {
          return JSON.stringify(a);
        } catch {
          return String(a);
        }
      }
      return String(a);
    }).join(' ');
    
    // Use Services.console which is always available in Firefox/Zotero
    if (typeof Services !== 'undefined' && Services.console) {
      Services.console.logStringMessage(message);
    }
  } catch (e) {
    // Silently fail if logging doesn't work
  }
}

export function error(...args: any[]) {
  try {
    const message = '[Nanopub Plugin ERROR] ' + args.map(a => {
      if (a instanceof Error) {
        return a.message + '\n' + a.stack;
      }
      if (typeof a === 'object') {
        try {
          return JSON.stringify(a);
        } catch {
          return String(a);
        }
      }
      return String(a);
    }).join(' ');
    
    if (typeof Services !== 'undefined' && Services.console) {
      Services.console.logStringMessage(message);
    }
  } catch (e) {
    // Silently fail if logging doesn't work
  }
}
