// Some Android/Hermes combinations used in local release APKs do not expose
// WeakRef / FinalizationRegistry yet. A light fallback keeps navigation and
// library caches from crashing on startup.
const globalScope = globalThis as typeof globalThis & {
  WeakRef?: new <T extends object>(value: T) => { deref(): T | undefined };
  FinalizationRegistry?: new <T>(cleanup: (heldValue: T) => void) => {
    register(target: object, heldValue: T, unregisterToken?: object): void;
    unregister(unregisterToken: object): boolean;
  };
};

if (typeof globalScope.WeakRef === "undefined") {
  class WeakRefFallback<T extends object> {
    private value?: T;

    constructor(value: T) {
      this.value = value;
    }

    deref() {
      return this.value;
    }
  }

  (globalScope as any).WeakRef = WeakRefFallback;
}

if (typeof globalScope.FinalizationRegistry === "undefined") {
  class FinalizationRegistryFallback<T> {
    constructor(_cleanup: (heldValue: T) => void) {}

    register(_target: object, _heldValue: T, _unregisterToken?: object) {}

    unregister(_unregisterToken: object) {
      return false;
    }
  }

  (globalScope as any).FinalizationRegistry = FinalizationRegistryFallback;
}

export {};
